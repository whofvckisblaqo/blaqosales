import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";
import { requireUser, unauthorized, fail, escapeRegex } from "@/lib/api";
import { parseProductInput } from "@/lib/productInput";

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const status = searchParams.get("status") || "all";

  const query = { isActive: true };

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { brand: rx }, { sku: rx }, { category: rx }];
  }

  if (status === "out_of_stock") query.stock = { $lte: 0 };
  if (status === "low_stock") {
    query.stock = { $gt: 0 };
    query.$expr = { $lte: ["$stock", "$lowStockThreshold"] };
  }
  if (status === "in_stock") {
    query.$expr = { $gt: ["$stock", "$lowStockThreshold"] };
  }

  const products = await Product.find(query).sort({ createdAt: -1 });
  return Response.json({ products });
}

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseProductInput(body, { isCreate: true });
  if (parsed.error) return fail(parsed.error);

  await connectDB();

  const data = { ...parsed.data };
  if (!data.sku) delete data.sku;

  try {
    const product = await Product.create(data);

    if (product.stock > 0) {
      await StockMovement.create({
        product: product._id,
        type: "initial",
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reason: "Opening stock",
      });
    }

    return Response.json({ product }, { status: 201 });
  } catch (err) {
    if (err?.code === 11000) return fail("A product with that SKU already exists.", 409);
    return fail("Could not save the product.", 500);
  }
}
