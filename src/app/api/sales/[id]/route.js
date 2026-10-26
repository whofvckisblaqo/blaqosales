import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import StockMovement from "@/models/StockMovement";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import Refund from "@/models/Refund";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { calculateSaleTotals, balanceOf, round2 } from "@/lib/money";
import { parseSaleInput } from "@/lib/saleInput";
import { resolveCustomer } from "@/lib/customerResolve";
import { getSettings } from "@/models/Settings";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Sale not found.", 404);

  await connectDB();
  const sale = await Sale.findById(id);
  if (!sale) return fail("Sale not found.", 404);

  const [items, payments] = await Promise.all([
    SaleItem.find({ sale: id }),
    Payment.find({ sale: id }).sort({ date: 1 }),
  ]);
  const refunds = await Refund.find({ sale: id }).sort({ date: 1 });

  return Response.json({ sale, items, payments, refunds });
}

// Deleting a sale puts its stock back and records that in the stock history.
export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Sale not found.", 404);

  await connectDB();
  const sale = await Sale.findById(id);
  if (!sale) return fail("Sale not found.", 404);

  const items = await SaleItem.find({ sale: id });

  for (const item of items) {
    // Anything already returned through a refund was put back then.
    const quantity = item.quantity - (item.restockedQuantity || 0);
    if (quantity <= 0) continue;

    const product = await Product.findByIdAndUpdate(item.product, { $inc: { stock: quantity } }, { new: true });
    if (!product) continue;

    await StockMovement.create({
      product: product._id,
      type: "sale_delete",
      quantity,
      previousStock: product.stock - quantity,
      newStock: product.stock,
      reason: `Sale ${sale.orderNumber} deleted`,
    });
  }

  await Promise.all([
    SaleItem.deleteMany({ sale: id }),
    Payment.deleteMany({ sale: id }),
    Refund.deleteMany({ sale: id }),
    Expense.deleteMany({ sale: id }),
    StockMovement.updateMany({ sale: id }, { $set: { sale: null } }),
  ]);
  await sale.deleteOne();

  return Response.json({ deleted: true });
}

// Editing a sale: items, prices, discount and charges can change. Stock is adjusted
// by the difference, profit is recalculated, and what the customer already paid is kept.
export async function PUT(request, { params }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Sale not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");
  const parsed = parseSaleInput(body);
  if (parsed.error) return fail(parsed.error);
  const input = parsed.data;

  await connectDB();
  const sale = await Sale.findById(id);
  if (!sale) return fail("Sale not found.", 404);
  if (sale.status !== "completed" || (sale.refundedRevenue || 0) > 0) {
    return fail("This sale has refunds, so it can no longer be edited.");
  }

  const oldItems = await SaleItem.find({ sale: id });
  const products = await Product.find({ _id: { $in: input.items.map((i) => i.productId) } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  for (const item of input.items) {
    if (!productMap.has(item.productId)) return fail("One of the products no longer exists.", 404);
  }

  const totals = calculateSaleTotals({
    items: input.items,
    discount: input.discount,
    deliveryFee: input.deliveryFee,
    otherCharges: input.otherCharges,
    amountPaid: sale.amountPaid,
  });
  if (totals.discount > totals.subtotal) return fail("Discount cannot be more than the sale amount.");
  if (sale.amountPaid > totals.total) {
    return fail("The customer has already paid more than the new total. Use a refund for the difference.");
  }
  if (totals.balance > 0 && !input.customerName && !input.customerPhone && !sale.customer) {
    return fail("Enter the customer's name for unpaid or part-paid sales.");
  }

  // Stock change per product: positive = more goes out, negative = some comes back.
  const settings = await getSettings();
  const delta = new Map();
  for (const it of oldItems) delta.set(String(it.product), -it.quantity);
  for (const it of input.items) delta.set(it.productId, (delta.get(it.productId) || 0) + it.quantity);

  const applied = []; // { productId, amount } actually applied, for undo
  const movements = [];
  async function undoStock() {
    for (const a of applied) await Product.updateOne({ _id: a.productId }, { $inc: { stock: -a.amount } });
  }

  if (settings.autoStockDeduction) {
    const entries = [...delta.entries()].filter(([, d]) => d !== 0).sort((a, b) => b[1] - a[1]);
    for (const [productId, d] of entries) {
      let updated;
      if (d > 0) {
        updated = await Product.findOneAndUpdate(
          settings.allowNegativeStock ? { _id: productId } : { _id: productId, stock: { $gte: d } },
          { $inc: { stock: -d } },
          { new: true }
        );
        if (!updated) {
          await undoStock();
          const p = productMap.get(productId);
          const current = await Product.findById(productId).select("stock");
          return fail(`Not enough stock for ${p?.label || "a product"}. Only ${Math.max(current?.stock ?? 0, 0)} more available.`);
        }
        applied.push({ productId, amount: -d });
        movements.push({ product: productId, quantity: -d, previousStock: updated.stock + d, newStock: updated.stock });
      } else {
        updated = await Product.findOneAndUpdate({ _id: productId }, { $inc: { stock: -d } }, { new: true });
        if (!updated) continue; // product was removed; nothing to put back
        applied.push({ productId, amount: -d });
        movements.push({ product: productId, quantity: -d, previousStock: updated.stock + d, newStock: updated.stock });
      }
    }
  }

  const backup = {
    sale: sale.toObject({ virtuals: false }),
    items: oldItems.map((i) => i.toObject({ virtuals: false })),
  };
  const expenseBefore = await Expense.findOne({ sale: id, kind: "packaging" });
  const expenseBackup = expenseBefore ? expenseBefore.toObject() : null;

  try {
    const customer = await resolveCustomer(input.customerName, input.customerPhone);

    await SaleItem.deleteMany({ sale: id });
    for (const item of input.items) {
      const p = productMap.get(item.productId);
      await SaleItem.create({
        sale: id,
        product: p._id,
        productName: p.label,
        category: p.category,
        quantity: item.quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
      });
    }

    sale.set({
      date: input.date,
      customer: customer?._id || null,
      customerName: customer?.name || "Walk-in customer",
      customerPhone: customer?.phone || input.customerPhone,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      otherCharges: totals.otherCharges,
      packagingCost: input.packagingCost,
      total: totals.total,
      totalCost: totals.totalCost,
      profit: totals.profit,
      balance: totals.balance,
      dueDate: totals.balance > 0 ? input.dueDate : null,
      paymentMethod: input.paymentMethod,
      paymentStatus: totals.paymentStatus,
      notes: input.notes,
      editedAt: new Date(),
    });
    await sale.save();

    // Bagging expense follows the sale.
    if (input.packagingCost > 0) {
      const fields = {
        name: `Bagging (${sale.orderNumber})`,
        category: "Packaging",
        amount: input.packagingCost,
        date: input.date,
        paymentMethod: "cash",
        description: `Bag/packaging cost for ${sale.orderNumber}`,
        kind: "packaging",
        sale: sale._id,
      };
      if (expenseBefore) await Expense.updateOne({ _id: expenseBefore._id }, { $set: fields });
      else await Expense.create(fields);
    } else if (expenseBefore) {
      await Expense.deleteOne({ _id: expenseBefore._id });
    }

    for (const m of movements) {
      await StockMovement.create({ ...m, type: "sale_edit", reason: `Sale ${sale.orderNumber} edited`, sale: sale._id });
    }

    const items = await SaleItem.find({ sale: id });
    return Response.json({ sale, items });
  } catch (err) {
    console.error("Sale edit failed and was rolled back:", err);
    await Promise.allSettled([
      undoStock(),
      SaleItem.deleteMany({ sale: id }).then(() => SaleItem.insertMany(backup.items)),
      Sale.replaceOne({ _id: id }, backup.sale),
      expenseBackup
        ? Expense.replaceOne({ _id: expenseBackup._id }, expenseBackup, { upsert: true })
        : Expense.deleteMany({ sale: id, kind: "packaging" }),
    ]);
    return fail("The changes could not be saved. Nothing was changed. Please try again.", 500);
  }
}
