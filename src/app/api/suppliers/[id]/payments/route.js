import connectDB from "@/lib/mongodb";
import Supplier from "@/models/Supplier";
import SupplierPayment from "@/models/SupplierPayment";
import { PAYMENT_METHODS } from "@/models/Sale";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { round2, formatNaira } from "@/lib/money";
import { statsForSuppliers } from "@/lib/supplierStats";

// Pay a supplier part or all of what you owe them.
export async function POST(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Supplier not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");
  const amount = round2(body.amount);
  if (!(Number(body.amount) > 0) || amount <= 0) return fail("Enter an amount above 0.");

  await connectDB();
  const supplier = await Supplier.findById(id);
  if (!supplier) return fail("Supplier not found.", 404);

  const stats = (await statsForSuppliers([supplier._id])).get(String(supplier._id));
  if (stats.owing <= 0) return fail("You do not owe this supplier anything.");
  if (amount > stats.owing) return fail(`That is more than the ${formatNaira(stats.owing)} you owe.`);

  const payment = await SupplierPayment.create({
    supplier: id,
    amount,
    method: PAYMENT_METHODS.includes(body.method) ? body.method : "cash",
    note: String(body.note || "").trim().slice(0, 200),
    date: new Date(),
  });
  return Response.json({ payment }, { status: 201 });
}
