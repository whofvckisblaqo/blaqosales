import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import Sale, { PAYMENT_METHODS } from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import StockMovement from "@/models/StockMovement";
import Payment from "@/models/Payment";
import Refund from "@/models/Refund";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { round2, balanceOf, formatNaira } from "@/lib/money";

// Refund (full or partial) for a sale.
//   items:      [{ itemId, quantity, restock }]  what comes back
//   cashRefund: money handed back to the customer (can be 0 to just reduce what they owe)
export async function POST(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Sale not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const rawItems = Array.isArray(body.items) ? body.items.filter((i) => Number(i.quantity) > 0) : [];
  if (rawItems.length === 0) return fail("Choose at least one item to refund.");

  const cashRefund = round2(body.cashRefund || 0);
  if (!(cashRefund >= 0)) return fail("Cash refunded cannot be negative.");
  const method = PAYMENT_METHODS.includes(body.method) ? body.method : "cash";
  const reason = String(body.reason || "").trim().slice(0, 300);

  await connectDB();
  const sale = await Sale.findById(id);
  if (!sale) return fail("Sale not found.", 404);
  if (sale.status === "refunded") return fail("This sale is already fully refunded.");

  const saleItems = await SaleItem.find({ sale: id });
  const byId = new Map(saleItems.map((i) => [String(i._id), i]));

  const share = sale.subtotal > 0 ? sale.discount / sale.subtotal : 0; // discount carried by each naira sold
  const lines = [];
  const seen = new Set();
  for (const raw of rawItems) {
    const item = byId.get(String(raw.itemId));
    if (!item) return fail("One of the items is not on this sale.");
    if (seen.has(String(item._id))) return fail("The same item was chosen twice.");
    seen.add(String(item._id));

    const quantity = Number(raw.quantity);
    const left = item.quantity - (item.returnedQuantity || 0);
    if (!Number.isInteger(quantity) || quantity < 1) return fail("Refund quantities must be whole numbers.");
    if (quantity > left) return fail(`Only ${left} of ${item.productName} can still be refunded.`);

    const restock = raw.restock !== false;
    lines.push({
      item,
      quantity,
      restock,
      revenue: round2(quantity * item.sellingPrice * (1 - share)),
      cost: restock ? round2(quantity * item.costPrice) : 0,
    });
  }

  // Will everything on the sale be returned after this?
  const fullyReturned = saleItems.every((i) => {
    const l = lines.find((x) => String(x.item._id) === String(i._id));
    return i.quantity - (i.returnedQuantity || 0) - (l ? l.quantity : 0) === 0;
  });

  let revenue = round2(lines.reduce((n, l) => n + l.revenue, 0));
  if (fullyReturned) {
    // Absorb rounding so refunds add up exactly to what was sold.
    const soldRevenue = round2(sale.subtotal - sale.discount);
    revenue = round2(soldRevenue - (sale.refundedRevenue || 0));
    const diff = round2(revenue - lines.reduce((n, l) => n + l.revenue, 0));
    lines[0].revenue = round2(lines[0].revenue + diff);
  }
  const cost = round2(lines.reduce((n, l) => n + l.cost, 0));

  const maxCash = round2(sale.amountPaid - (sale.refundedAmount || 0));
  if (cashRefund > maxCash) return fail(`The customer has only paid ${formatNaira(maxCash)} that can be given back.`);

  const refundedRevenue = round2((sale.refundedRevenue || 0) + revenue);
  const refundedAmount = round2((sale.refundedAmount || 0) + cashRefund);
  const balance = balanceOf({ total: sale.total, refundedRevenue, amountPaid: sale.amountPaid, refundedAmount });
  const netPaid = round2(sale.amountPaid - refundedAmount);
  const paymentStatus = balance <= 0 ? "paid" : netPaid > 0 ? "partial" : "unpaid";

  // 1. Update the sale (retries safely if something else changed it meanwhile).
  const updatedSale = await Sale.findOneAndUpdate(
    {
      _id: id,
      // "$in [0, null]" also matches sales saved before these fields existed.
      refundedRevenue: sale.refundedRevenue ? sale.refundedRevenue : { $in: [0, null] },
      refundedAmount: sale.refundedAmount ? sale.refundedAmount : { $in: [0, null] },
      amountPaid: sale.amountPaid,
    },
    {
      $set: {
        refundedRevenue,
        refundedAmount,
        refundedCost: round2((sale.refundedCost || 0) + cost),
        refundedProfit: round2((sale.refundedProfit || 0) + revenue - cost),
        balance,
        paymentStatus,
        status: fullyReturned ? "refunded" : "partially_refunded",
        ...(balance <= 0 ? { dueDate: null } : {}),
      },
    },
    { new: true }
  );
  if (!updatedSale) return fail("The sale changed while you were refunding. Please try again.", 409);

  // Steps already done, so everything can be undone if a later step fails.
  const doneItems = [];
  const doneStock = [];
  let refundDoc = null;
  let paymentDoc = null;
  const movementIds = [];

  async function rollback() {
    await Promise.allSettled([
      ...doneItems.map((l) =>
        SaleItem.updateOne(
          { _id: l.item._id },
          { $inc: { returnedQuantity: -l.quantity, restockedQuantity: l.restock ? -l.quantity : 0 } }
        )
      ),
      ...doneStock.map((s) => Product.updateOne({ _id: s.product }, { $inc: { stock: -s.quantity } })),
      StockMovement.deleteMany({ _id: { $in: movementIds } }),
      refundDoc ? Refund.deleteOne({ _id: refundDoc._id }) : null,
      paymentDoc ? Payment.deleteOne({ _id: paymentDoc._id }) : null,
      Sale.replaceOne({ _id: id }, sale.toObject({ virtuals: false })),
    ]);
  }

  try {
    // 2. Mark the items as returned (never beyond what was sold).
    for (const l of lines) {
      const ok = await SaleItem.findOneAndUpdate(
        { _id: l.item._id, $expr: { $lte: [{ $add: ["$returnedQuantity", l.quantity] }, "$quantity"] } },
        { $inc: { returnedQuantity: l.quantity, restockedQuantity: l.restock ? l.quantity : 0 } }
      );
      if (!ok) throw new Error("Item already refunded");
      doneItems.push(l);
    }

    // 3. Put returned goods back in stock.
    for (const l of lines.filter((x) => x.restock)) {
      const product = await Product.findByIdAndUpdate(l.item.product, { $inc: { stock: l.quantity } }, { new: true });
      if (!product) continue;
      doneStock.push({ product: product._id, quantity: l.quantity });
      const mv = await StockMovement.create({
        product: product._id,
        type: "refund_return",
        quantity: l.quantity,
        previousStock: product.stock - l.quantity,
        newStock: product.stock,
        reason: `Refund on ${sale.orderNumber}`,
        sale: sale._id,
      });
      movementIds.push(mv._id);
    }

    // 4. The refund record and the money handed back.
    refundDoc = await Refund.create({
      sale: sale._id,
      orderNumber: sale.orderNumber,
      date: new Date(),
      items: lines.map((l) => ({
        saleItem: l.item._id,
        product: l.item.product,
        productName: l.item.productName,
        quantity: l.quantity,
        restock: l.restock,
        revenue: l.revenue,
        cost: l.cost,
      })),
      revenue,
      cost,
      cashRefunded: cashRefund,
      method,
      reason,
    });

    if (cashRefund > 0) {
      paymentDoc = await Payment.create({
        sale: sale._id,
        type: "refund",
        source: "refund",
        amount: cashRefund,
        method,
        date: new Date(),
        reference: reason,
      });
    }

    return Response.json({ sale: updatedSale, refund: refundDoc }, { status: 201 });
  } catch (err) {
    console.error("Refund failed and was rolled back:", err);
    await rollback();
    return fail("The refund could not be saved. Nothing was changed. Please try again.", 500);
  }
}
