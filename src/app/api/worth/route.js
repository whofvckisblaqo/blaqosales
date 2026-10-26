import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized } from "@/lib/api";
import { buildWorth } from "@/lib/worth";

export async function GET() {
  if (!(await requireUser())) return unauthorized();
  await connectDB();
  return Response.json(await buildWorth());
}
