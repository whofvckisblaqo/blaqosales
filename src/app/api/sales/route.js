import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import StockMovement from "@/models/StockMovement";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import { nextOrderNumber } from "@/models/Counter";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { resolveCustomer } from "@/lib/customerResolve";
import { calculateSaleTotals } from "@/lib/money";
import { parseSaleInput } from "@/lib/saleInput";
import { buildSaleQuery, sortFor } from "@/lib/saleFilters";
import { round2 } from "@/lib/money";
import { NET_SALES, NET_COST, NET_PROFIT } from "@/lib/stats";
import { getSettings } from "@/models/Settings";

// Puts stock back if a sale could not be completed.
async function restoreStock(deducted) {
  for (const d of deducted) {
    await Product.updateOne({ _id: d.productId }, { $inc: { stock: d.quantity } });
  }
}

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const query = await buildSaleQuery(searchParams);
  const limit = 20;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [sales, count, agg] = await Promise.all([
    Sale.find(query)
      .sort(sortFor(searchParams.get("sort")))
      .skip((page - 1) * limit)
      .limit(limit),
    Sale.countDocuments(query),
    Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          revenue: { $sum: NET_SALES },
          cost: { $sum: NET_COST },
          profit: { $sum: NET_PROFIT },
          balance: { $sum: "$balance" },
        },
      },
    ]),
  ]);

  const items = await SaleItem.find({ sale: { $in: sales.map((s) => s._id) } });
  const bySale = new Map();
  for (const it of items) {
    const key = String(it.sale);
    if (!bySale.has(key)) bySale.set(key, []);
    bySale.get(key).push(it);
  }

  const a = agg[0] || {};
  return Response.json({
    sales: sales.map((s) => ({ ...s.toJSON(), items: bySale.get(String(s._id)) || [] })),
    count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    summary: {
      revenue: round2(a.revenue || 0),
      cost: round2(a.cost || 0),
      profit: round2(a.profit || 0),
      balance: round2(a.balance || 0),
    },
  });
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseSaleInput(body);
  if (parsed.error) return fail(parsed.error);
  const input = parsed.data;

  await connectDB();

  // 1. Load products and build the items with the prices entered for this sale.
  const products = await Product.find({ _id: { $in: input.items.map((i) => i.productId) }, isActive: true });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  for (const item of input.items) {
    if (!productMap.has(item.productId)) return fail("One of the products no longer exists.", 404);
  }

  // 2. Recalculate everything on the server. The client's numbers are never trusted.
  const totals = calculateSaleTotals({
    items: input.items,
    discount: input.discount,
    deliveryFee: input.deliveryFee,
    otherCharges: input.otherCharges,
    amountPaid: input.amountPaid,
  });

  if (totals.discount > totals.subtotal) return fail("Discount cannot be more than the sale amount.");
  if (input.amountPaid > totals.total) return fail("Amount paid cannot be more than the sale total.");
  if (totals.balance > 0 && !input.customerName && !input.customerPhone) {
    return fail("Enter the customer's name for unpaid or part-paid sales.");
  }

  // 3. Take stock. Each product is one atomic update that refuses to go below zero
  //    (unless "allow negative stock" is switched on in Settings).
  const settings = await getSettings();
  const deducted = [];
  for (const item of settings.autoStockDeduction ? input.items : []) {
    const updated = await Product.findOneAndUpdate(
      settings.allowNegativeStock
        ? { _id: item.productId }
        : { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      await restoreStock(deducted);
      const p = productMap.get(item.productId);
      const current = await Product.findById(item.productId).select("stock");
      return fail(`Not enough stock for ${p.label}. Only ${Math.max(current?.stock ?? 0, 0)} left.`);
    }

    deducted.push({
      productId: item.productId,
      quantity: item.quantity,
      previousStock: updated.stock + item.quantity,
      newStock: updated.stock,
    });
  }

  // 4. Record the sale. If anything fails, undo it all so stock stays correct.
  let sale = null;
  try {
    const customer = await resolveCustomer(input.customerName, input.customerPhone);
    const orderNumber = await nextOrderNumber();

    sale = await Sale.create({
      orderNumber,
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
      amountPaid: totals.amountPaid,
      balance: totals.balance,
      dueDate: totals.balance > 0 ? input.dueDate : null,
      paymentMethod: input.paymentMethod,
      paymentStatus: totals.paymentStatus,
      notes: input.notes,
      createdBy: user.id,
    });

    // Snapshot of cost and selling price at the moment of sale.
    const saleItems = [];
    for (const item of input.items) {
      const p = productMap.get(item.productId);
      saleItems.push(
        await SaleItem.create({
          sale: sale._id,
          product: p._id,
          productName: p.label,
          category: p.category,
          quantity: item.quantity,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
        })
      );
    }

    for (const d of deducted) {
      await StockMovement.create({
        product: d.productId,
        type: "sale",
        quantity: -d.quantity,
        previousStock: d.previousStock,
        newStock: d.newStock,
        reason: `Sale ${orderNumber}`,
        sale: sale._id,
      });
    }

    if (totals.amountPaid > 0) {
      await Payment.create({
        sale: sale._id,
        type: "payment",
        source: "sale",
        amount: totals.amountPaid,
        method: input.paymentMethod,
        date: input.date,
      });
    }

    // Bagging cost is recorded together with the sale as a Packaging expense.
    if (input.packagingCost > 0) {
      await Expense.create({
        name: `Bagging (${orderNumber})`,
        category: "Packaging",
        amount: input.packagingCost,
        date: input.date,
        paymentMethod: "cash",
        description: `Bag/packaging cost for ${orderNumber}`,
        kind: "packaging",
        sale: sale._id,
      });
    }

    return Response.json({ sale, items: saleItems }, { status: 201 });
  } catch (err) {
    if (sale) {
      await Promise.allSettled([
        SaleItem.deleteMany({ sale: sale._id }),
        StockMovement.deleteMany({ sale: sale._id }),
        Payment.deleteMany({ sale: sale._id }),
        Expense.deleteMany({ sale: sale._id }),
        Sale.deleteOne({ _id: sale._id }),
      ]);
    }
    await restoreStock(deducted);
    console.error("Sale failed and was rolled back:", err);
    return fail("The sale could not be saved. Nothing was changed. Please try again.", 500);
  }
}
