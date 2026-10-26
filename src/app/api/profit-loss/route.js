import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { round2 } from "@/lib/money";
import { todayStr, weekStartStr, monthStartStr, startOfDay, endOfDay } from "@/lib/dates";
import { COUNTED_KINDS } from "@/lib/expenseFilters";
import { salesTotals, productsSold } from "@/lib/stats";

// Profit and Loss for a period:
//   Revenue            sales of goods (subtotal - discount)
//   - Cost of goods    what the sold products cost (delivery costs are inside this)
//   = Gross profit
//   - Expenses         business expenses and bagging
//   = Net profit
export async function GET(request) {
  if (!(await requireUser())) return unauthorized();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month";
  const today = todayStr();

  let from;
  let to = today;
  if (period === "today") from = today;
  else if (period === "week") from = weekStartStr();
  else if (period === "month") from = monthStartStr();
  else if (period === "custom") {
    from = searchParams.get("from");
    to = searchParams.get("to");
    if (!from || !to || !startOfDay(from) || !endOfDay(to)) return fail("Choose a start and end date.");
    if (from > to) return fail("The start date must be before the end date.");
  } else {
    return fail("Unknown period.");
  }

  await connectDB();
  const start = startOfDay(from);
  const end = endOfDay(to);

  const [totals, sold, byCategory] = await Promise.all([
    salesTotals(start, end),
    productsSold(start, end),
    Expense.aggregate([
      { $match: { kind: { $in: COUNTED_KINDS }, date: { $gte: start, $lte: end } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const revenue = totals.sales;
  const grossProfit = totals.profit;
  const costOfGoods = round2(revenue - grossProfit);
  const expenses = round2(byCategory.reduce((n, c) => n + c.total, 0));
  const netProfit = round2(grossProfit - expenses);

  return Response.json({
    period,
    range: { from, to },
    revenue,
    costOfGoods,
    grossProfit,
    grossMargin: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
    expenses,
    expensesByCategory: byCategory.map((c) => ({ category: c._id, total: round2(c.total) })),
    netProfit,
    netMargin: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
    orders: totals.orders,
    productsSold: sold,
  });
}
