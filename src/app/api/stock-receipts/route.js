import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import StockReceipt from "@/models/StockReceipt";
import StockMovement from "@/models/StockMovement";
import Expense from "@/models/Expense";
import Supplier from "@/models/Supplier";
import { nextSequence } from "@/models/Counter";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { allocateInboundCosts, blendedCost } from "@/lib/landedCost";
import { parseReceiptInput } from "@/lib/receiptInput";

// Adds the goods to stock and updates the cost price, retrying if a sale
// changed the product at the same moment.
async function applyLine(productId, quantity, lineTotal) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const p = await Product.findById(productId);
    if (!p) return null;

    const newCost = blendedCost({ stock: p.stock, costPrice: p.costPrice, quantity, lineTotal });
    const updated = await Product.findOneAndUpdate(
      { _id: productId, stock: p.stock, costPrice: p.costPrice },
      { $set: { stock: p.stock + quantity, costPrice: newCost } },
      { new: true }
    );

    if (updated) {
      return { previousStock: p.stock, newStock: updated.stock, previousCost: p.costPrice, newCost };
    }
  }
  return null;
}

async function undoLines(applied) {
  for (const a of applied) {
    await Product.updateOne(
      { _id: a.productId },
      { $inc: { stock: -a.quantity }, $set: { costPrice: a.previousCost } }
    );
  }
}

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseReceiptInput(body);
  if (parsed.error) return fail(parsed.error);
  const input = parsed.data;

  await connectDB();

  const products = await Product.find({ _id: { $in: input.items.map((i) => i.productId) }, isActive: true });
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  for (const item of input.items) {
    if (!productMap.has(item.productId)) return fail("One of the products no longer exists.", 404);
  }

  // Share the costs of bringing the goods in. Same function the page preview uses.
  const allocation = allocateInboundCosts({
    items: input.items,
    expenses: input.expenses,
    method: input.method,
  });

  let supplier = null;
  if (input.supplierId) {
    supplier = await Supplier.findById(input.supplierId);
    if (!supplier) return fail("That supplier no longer exists.", 404);
  }
  if (input.amountPaid > allocation.goodsTotal) {
    return fail("You cannot pay the supplier more than the goods cost. Use Pay supplier on their page for extra payments.");
  }

  const seq = await nextSequence("purchase");
  const receiptNumber = `PUR-${String(seq).padStart(6, "0")}`;

  const applied = [];
  let receipt = null;

  try {
    const receiptItems = [];

    for (let idx = 0; idx < input.items.length; idx++) {
      const item = input.items[idx];
      const line = allocation.lines[idx];
      const result = await applyLine(item.productId, item.quantity, line.lineTotal);

      if (!result) {
        throw new Error("Could not update stock for a product. Please try again.");
      }
      applied.push({ productId: item.productId, quantity: item.quantity, previousCost: result.previousCost });

      receiptItems.push({
        product: item.productId,
        productName: productMap.get(item.productId).label,
        quantity: item.quantity,
        unitCost: item.unitCost,
        goodsCost: line.goodsCost,
        expenseShare: line.share,
        lineTotal: line.lineTotal,
        landedUnitCost: line.landedUnitCost,
        previousStock: result.previousStock,
        newStock: result.newStock,
        previousCost: result.previousCost,
        newCost: result.newCost,
      });
    }

    receipt = await StockReceipt.create({
      receiptNumber,
      date: input.date,
      items: receiptItems,
      expenses: input.expenses,
      method: input.method,
      goodsTotal: allocation.goodsTotal,
      expensesTotal: allocation.expensesTotal,
      grandTotal: allocation.grandTotal,
      note: input.note,
      supplier: supplier?._id || null,
      supplierName: supplier?.name || "",
      amountPaid: input.amountPaid,
    });

    for (const ri of receiptItems) {
      await StockMovement.create({
        product: ri.product,
        type: "restock",
        quantity: ri.quantity,
        previousStock: ri.previousStock,
        newStock: ri.newStock,
        reason: `Received ${receiptNumber}`,
        receipt: receipt._id,
      });
    }

    // The costs are already inside the products' cost price, so these are marked
    // "inbound" and are not subtracted from profit a second time.
    for (const e of input.expenses) {
      await Expense.create({
        name: e.name,
        category: e.category,
        amount: e.amount,
        date: input.date,
        paymentMethod: "cash",
        description: `Cost of bringing in goods (${receiptNumber})`,
        kind: "inbound",
        stockReceipt: receipt._id,
      });
    }

    return Response.json({ receipt }, { status: 201 });
  } catch (err) {
    if (receipt) {
      await Promise.allSettled([
        StockMovement.deleteMany({ receipt: receipt._id }),
        Expense.deleteMany({ stockReceipt: receipt._id }),
        StockReceipt.deleteOne({ _id: receipt._id }),
      ]);
    }
    await undoLines(applied);
    console.error("Stock receipt failed and was rolled back:", err);
    return fail("The delivery could not be saved. Nothing was changed. Please try again.", 500);
  }
}
