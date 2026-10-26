import connectDB from "@/lib/mongodb";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import { requireUser, unauthorized, escapeRegex } from "@/lib/api";
import { round2 } from "@/lib/money";

// Sales that still have a balance to collect.
export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const q = (searchParams.get("q") || "").trim();
  const limit = 20;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const now = new Date();

  const query = { balance: { $gt: 0 } };
  if (status === "unpaid") query.paymentStatus = "unpaid";
  if (status === "partial") query.paymentStatus = "partial";
  if (status === "overdue") query.dueDate = { $lt: now };
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ customerName: rx }, { customerPhone: rx }, { orderNumber: rx }];
  }

  const [sales, count, totals, overdue] = await Promise.all([
    Sale.find(query)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Sale.countDocuments(query),
    Sale.aggregate([
      { $match: { balance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$balance" }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { balance: { $gt: 0 }, dueDate: { $lt: now } } },
      { $group: { _id: null, total: { $sum: "$balance" }, count: { $sum: 1 } } },
    ]),
  ]);

  const items = await SaleItem.find({ sale: { $in: sales.map((s) => s._id) } });
  const bySale = new Map();
  for (const it of items) {
    const key = String(it.sale);
    if (!bySale.has(key)) bySale.set(key, []);
    bySale.get(key).push(it);
  }

  return Response.json({
    sales: sales.map((s) => ({ ...s.toJSON(), items: bySale.get(String(s._id)) || [] })),
    count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    summary: {
      totalOwed: round2(totals[0]?.total || 0),
      orders: totals[0]?.count || 0,
      overdueOwed: round2(overdue[0]?.total || 0),
      overdueOrders: overdue[0]?.count || 0,
    },
  });
}
