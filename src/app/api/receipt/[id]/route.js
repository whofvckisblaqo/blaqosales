import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { loadReceipt } from "@/lib/receiptData";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  await connectDB();
  const data = await loadReceipt(id);
  if (!data) return fail("Sale not found.", 404);
  return Response.json(data);
}
