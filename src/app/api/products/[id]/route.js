import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import SaleItem from "@/models/SaleItem";
import StockMovement from "@/models/StockMovement";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { parseProductInput } from "@/lib/productInput";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Product not found.", 404);

  await connectDB();
  const product = await Product.findById(id);
  if (!product) return fail("Product not found.", 404);
  return Response.json({ product });
}

// Edits details and prices. Stock is changed only through /stock so every
// change is recorded. Past sales keep their own price snapshot.
export async function PUT(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Product not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseProductInput(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();

  const { sku, ...rest } = parsed.data;
  const update = sku ? { $set: { ...rest, sku } } : { $set: rest, $unset: { sku: "" } };

  try {
    const product = await Product.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!product) return fail("Product not found.", 404);
    return Response.json({ product });
  } catch (err) {
    if (err?.code === 11000) return fail("A product with that SKU already exists.", 409);
    return fail("Could not update the product.", 500);
  }
}

// A product that was never sold is deleted. A product with sales is archived
// instead, so old sales and reports keep working.
export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Product not found.", 404);

  await connectDB();
  const product = await Product.findById(id);
  if (!product) return fail("Product not found.", 404);

  const hasSales = await SaleItem.exists({ product: id });
  if (hasSales) {
    product.isActive = false;
    await product.save();
    return Response.json({ archived: true });
  }

  await StockMovement.deleteMany({ product: id });
  await product.deleteOne();
  return Response.json({ deleted: true });
}
