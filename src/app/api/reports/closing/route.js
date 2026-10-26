import connectDB from "@/lib/mongodb";
import DayClosing from "@/models/DayClosing";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { buildReport } from "@/lib/reportData";
import { round2 } from "@/lib/money";
import { todayStr } from "@/lib/dates";

// Close Day: saves a snapshot of the day's figures and the cash you counted.
export async function POST(request) {
  if (!(await requireUser())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(body.day || "")) return fail("Choose a day to close.");
  if (body.day > todayStr()) return fail("You cannot close a day that has not happened yet.");

  let countedCash = null;
  if (body.countedCash !== "" && body.countedCash != null) {
    countedCash = round2(body.countedCash);
    if (!(countedCash >= 0)) return fail("Counted cash cannot be negative.");
  }

  await connectDB();
  const report = await buildReport("closing", new URLSearchParams({ day: body.day }));
  if (report.error) return fail(report.error);

  const doc = await DayClosing.findOneAndUpdate(
    { day: body.day },
    { $set: { snapshot: { summary: report.summary, rows: report.rows, expectedCash: report.extra.expectedCash }, countedCash, note: String(body.note || "").trim().slice(0, 300), closedAt: new Date() } },
    { upsert: true, new: true }
  );
  return Response.json({ closing: doc }, { status: 201 });
}

// Reopen a closed day.
export async function DELETE(request) {
  if (!(await requireUser())) return unauthorized();
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return fail("Choose a day.");
  await connectDB();
  await DayClosing.deleteOne({ day });
  return Response.json({ reopened: true });
}
