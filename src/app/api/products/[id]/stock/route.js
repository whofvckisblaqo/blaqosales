import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";

// Increase or reduce stock. The change is a single atomic update, and reducing
// never goes below zero. Every change is written to the stock history.
export async function POST(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Product not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const action = body.action;
  const quantity = Math.floor(Number(body.quantity));
  const reason = String(body.reason || "").trim();

  if (!["increase", "reduce"].includes(action)) return fail("Choose increase or reduce.");
  if (!Number.isFinite(quantity) || quantity < 1) return fail("Enter a quantity of 1 or more.");

  await connectDB();

  const delta = action === "increase" ? quantity : -quantity;
  const filter = action === "reduce" ? { _id: id, stock: { $gte: quantity } } : { _id: id };

  const product = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true });

  if (!product) {
    const exists = await Product.exists({ _id: id });
    return fail(exists ? "Not enough stock to reduce by that amount." : "Product not found.", exists ? 400 : 404);
  }

  await StockMovement.create({
    product: product._id,
    type: action === "increase" ? "restock" : "adjustment_out",
    quantity: delta,
    previousStock: product.stock - delta,
    newStock: product.stock,
    reason: reason || (action === "increase" ? "Stock added" : "Stock reduced"),
  });

  return Response.json({ product });
}
