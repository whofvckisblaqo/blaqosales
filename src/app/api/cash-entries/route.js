import connectDB from "@/lib/mongodb";
import CashEntry from "@/models/CashEntry";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { round2 } from "@/lib/money";
import { noonOf, formatDate, todayStr } from "@/lib/dates";

export async function GET() {
  if (!(await requireUser())) return unauthorized();
  await connectDB();
  const entries = await CashEntry.find().sort({ date: -1 }).limit(200);
  return Response.json({
    entries: entries.map((c) => ({ _id: String(c._id), type: c.type, name: c.name, amount: c.amount, date: formatDate(c.date), note: c.note })),
  });
}

// Money in or out that is not a sale or an expense (capital, owner withdrawal).
export async function POST(request) {
  if (!(await requireUser())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const type = body.type === "withdrawal" ? "withdrawal" : "income";
  const name = String(body.name || "").trim().slice(0, 100);
  if (!name) return fail("Enter what this is for.");
  const amount = round2(body.amount);
  if (!(Number(body.amount) > 0) || amount <= 0) return fail("Enter an amount above 0.");

  let date = new Date();
  if (body.date) {
    if (String(body.date) > todayStr()) return fail("The date cannot be in the future.");
    const d = noonOf(String(body.date));
    if (d) date = d;
  }

  await connectDB();
  const entry = await CashEntry.create({ type, name, amount, date, note: String(body.note || "").trim().slice(0, 300) });
  return Response.json({ entry }, { status: 201 });
}
