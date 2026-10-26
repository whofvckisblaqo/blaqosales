import connectDB from "@/lib/mongodb";
import CashEntry from "@/models/CashEntry";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";

export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Entry not found.", 404);
  await connectDB();
  await CashEntry.deleteOne({ _id: id });
  return Response.json({ deleted: true });
}
