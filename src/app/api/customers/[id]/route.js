import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { parseCustomerInput } from "@/lib/customerInput";
import { statsForCustomers, EMPTY_STATS } from "@/lib/customerStats";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Customer not found.", 404);

  await connectDB();
  const customer = await Customer.findById(id);
  if (!customer) return fail("Customer not found.", 404);

  const [stats, sales] = await Promise.all([
    statsForCustomers([customer._id]),
    Sale.find({ customer: id }).sort({ date: -1 }).limit(300),
  ]);

  const items = await SaleItem.find({ sale: { $in: sales.map((s) => s._id) } });
  const bySale = new Map();
  for (const it of items) {
    const key = String(it.sale);
    if (!bySale.has(key)) bySale.set(key, []);
    bySale.get(key).push(it);
  }

  return Response.json({
    customer: { ...customer.toJSON(), ...(stats.get(String(customer._id)) || EMPTY_STATS) },
    sales: sales.map((s) => ({ ...s.toJSON(), items: bySale.get(String(s._id)) || [] })),
  });
}

export async function PUT(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Customer not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseCustomerInput(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();

  if (parsed.data.phone && (await Customer.exists({ phone: parsed.data.phone, _id: { $ne: id } }))) {
    return fail("Another customer already has this phone number.", 409);
  }

  const customer = await Customer.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
  if (!customer) return fail("Customer not found.", 404);

  // Keep the name and phone on their past sales in step with the customer.
  await Sale.updateMany(
    { customer: id },
    { $set: { customerName: customer.name, customerPhone: customer.phone } }
  );

  return Response.json({ customer });
}

export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Customer not found.", 404);

  await connectDB();
  const orders = await Sale.countDocuments({ customer: id });
  if (orders > 0) {
    return fail(
      `This customer has ${orders} order${orders === 1 ? "" : "s"} on record, so they can't be deleted. Their history stays intact.`,
      400
    );
  }

  await Customer.deleteOne({ _id: id });
  return Response.json({ deleted: true });
}
