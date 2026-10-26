import connectDB from "@/lib/mongodb";
import Settings, { getSettings } from "@/models/Settings";
import { requireUser, unauthorized } from "@/lib/api";
import { stockValue } from "@/lib/worth";

// "Start recording from now": saves the value of the goods you have loaded as the starting point.
export async function POST() {
  if (!(await requireUser())) return unauthorized();
  await connectDB();
  await getSettings();
  const stock = await stockValue();
  await Settings.updateOne({ key: "main" }, { $set: { startedAt: new Date(), startingStockValue: stock.value } });
  return Response.json({ started: true });
}
