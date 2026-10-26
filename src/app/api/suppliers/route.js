import connectDB from "@/lib/mongodb";
import Supplier from "@/models/Supplier";
import { requireUser, unauthorized, fail, escapeRegex } from "@/lib/api";
import { statsForSuppliers } from "@/lib/supplierStats";
import { parseSupplier } from "@/lib/supplierInput";

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const query = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }

  const suppliers = await Supplier.find(query).sort({ name: 1 });
  if (searchParams.get("all") === "1") {
    return Response.json({ suppliers: suppliers.map((s) => ({ _id: s._id, name: s.name })) });
  }

  const stats = await statsForSuppliers(suppliers.map((s) => s._id));
  const list = suppliers.map((s) => ({ ...s.toJSON(), ...stats.get(String(s._id)) }));
  const totalOwing = list.reduce((n, s) => n + s.owing, 0);
  return Response.json({ suppliers: list, totalOwing });
}

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");
  const parsed = parseSupplier(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();
  const supplier = await Supplier.create(parsed.data);
  return Response.json({ supplier }, { status: 201 });
}
