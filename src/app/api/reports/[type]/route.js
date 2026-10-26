import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { buildReport } from "@/lib/reportData";

export async function GET(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { type } = await params;
  await connectDB();
  const { searchParams } = new URL(request.url);
  const report = await buildReport(type, searchParams);
  if (report.error) return fail(report.error);
  return Response.json({ report });
}
