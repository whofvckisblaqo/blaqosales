import connectDB from "@/lib/mongodb";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import { requireUser, unauthorized } from "@/lib/api";
import { round2 } from "@/lib/money";
import { todayStr, weekStartStr, monthStartStr, startOfDay, endOfDay, TIME_ZONE } from "@/lib/dates";
import { buildBuckets, RANGE_OPTIONS } from "@/lib/dashboardRange";
import { NET_SALES, NET_PROFIT, salesTotals, expenseTotal, productsSold, outstandingTotal } from "@/lib/stats";

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("range");
  const range = RANGE_OPTIONS.some((r) => r.value === requested) ? requested : "30d";

  const today = todayStr();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = startOfDay(weekStartStr());
  const monthStart = startOfDay(monthStartStr());

  const { start, buckets, keyOfDay } = buildBuckets(range);

  const [
    todaySales, weekSales, monthSales,
    todayExp, weekExp, monthExp,
    soldThisMonth, outstanding, daily, recent,
  ] = await Promise.all([
    salesTotals(dayStart, dayEnd),
    salesTotals(weekStart, dayEnd),
    salesTotals(monthStart, dayEnd),
    expenseTotal(dayStart, dayEnd),
    expenseTotal(weekStart, dayEnd),
    expenseTotal(monthStart, dayEnd),
    productsSold(monthStart, dayEnd),
    outstandingTotal(),
    Sale.aggregate([
      { $match: { date: { $gte: startOfDay(start), $lte: dayEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: TIME_ZONE } },
          sales: { $sum: NET_SALES },
          profit: { $sum: NET_PROFIT },
        },
      },
    ]),
    Sale.find().sort({ date: -1 }).limit(5),
  ]);

  // Put each day into its chart column (day, week or month).
  const points = buckets.map((b) => ({ ...b, sales: 0, profit: 0 }));
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const d of daily) {
    const i = index.get(keyOfDay(d._id));
    if (i === undefined) continue;
    points[i].sales += d.sales;
    points[i].profit += d.profit;
  }
  for (const p of points) {
    p.sales = round2(p.sales);
    p.profit = round2(p.profit);
  }

  const items = await SaleItem.find({ sale: { $in: recent.map((s) => s._id) } });
  const bySale = new Map();
  for (const it of items) {
    const key = String(it.sale);
    if (!bySale.has(key)) bySale.set(key, []);
    bySale.get(key).push(it);
  }

  return Response.json({
    today: { ...todaySales, expenses: todayExp, net: round2(todaySales.profit - todayExp) },
    week: { ...weekSales, expenses: weekExp, net: round2(weekSales.profit - weekExp) },
    month: {
      ...monthSales,
      expenses: monthExp,
      net: round2(monthSales.profit - monthExp),
      productsSold: soldThisMonth,
    },
    outstanding,
    chart: {
      range,
      points,
      totalSales: round2(points.reduce((n, p) => n + p.sales, 0)),
      totalProfit: round2(points.reduce((n, p) => n + p.profit, 0)),
    },
    recent: recent.map((s) => ({ ...s.toJSON(), items: bySale.get(String(s._id)) || [] })),
  });
}
