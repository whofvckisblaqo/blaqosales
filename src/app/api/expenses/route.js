import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { round2 } from "@/lib/money";
import { parseExpenseInput } from "@/lib/expenseInput";
import { buildExpenseQuery, COUNTED_KINDS } from "@/lib/expenseFilters";
import { todayStr, weekStartStr, monthStartStr, startOfDay, endOfDay } from "@/lib/dates";

async function total(match) {
  const r = await Expense.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return round2(r[0]?.total || 0);
}

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const query = buildExpenseQuery(searchParams);
  const limit = 20;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const today = todayStr();
  const counted = { kind: { $in: COUNTED_KINDS } };

  const [expenses, count, todayTotal, weekTotal, monthTotal, allTotal, deliveryMonth, byCategory] = await Promise.all([
    Expense.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(query),
    total({ ...counted, date: { $gte: startOfDay(today), $lte: endOfDay(today) } }),
    total({ ...counted, date: { $gte: startOfDay(weekStartStr()), $lte: endOfDay(today) } }),
    total({ ...counted, date: { $gte: startOfDay(monthStartStr()), $lte: endOfDay(today) } }),
    total(counted),
    total({ kind: "inbound", date: { $gte: startOfDay(monthStartStr()), $lte: endOfDay(today) } }),
    Expense.aggregate([
      { $match: { ...buildExpenseQuery(searchParams, { ignoreKind: true }), ...counted } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  return Response.json({
    expenses,
    count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    summary: { today: todayTotal, week: weekTotal, month: monthTotal, all: allTotal, deliveryMonth },
    byCategory: byCategory.map((c) => ({ category: c._id, total: round2(c.total) })),
  });
}

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseExpenseInput(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();
  const expense = await Expense.create({ ...parsed.data, kind: "operating" });
  return Response.json({ expense }, { status: 201 });
}
