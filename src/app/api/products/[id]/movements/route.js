import connectDB from "@/lib/mongodb";
import StockMovement from "@/models/StockMovement";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Product not found.", 404);

  await connectDB();
  const movements = await StockMovement.find({ product: id }).sort({ createdAt: -1 }).limit(200);
  return Response.json({ movements });
}
