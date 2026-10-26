import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Sale from "@/models/Sale";
import { requireUser, unauthorized, fail, escapeRegex } from "@/lib/api";
import { parseCustomerInput } from "@/lib/customerInput";
import { statsForCustomers, EMPTY_STATS } from "@/lib/customerStats";

export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") || "name";
  const limit = 20;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const query = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }

  const customers = await Customer.find(query).limit(2000);
  const stats = await statsForCustomers(customers.map((c) => c._id));

  let rows = customers.map((c) => ({ ...c.toJSON(), ...(stats.get(String(c._id)) || EMPTY_STATS) }));

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    spent: (a, b) => b.spent - a.spent,
    owes: (a, b) => b.balance - a.balance,
    recent: (a, b) => new Date(b.lastPurchase || 0) - new Date(a.lastPurchase || 0),
  };
  rows.sort(sorters[sort] || sorters.name);

  const count = rows.length;
  rows = rows.slice((page - 1) * limit, page * limit);

  const owingCustomers = (await Sale.distinct("customer", { balance: { $gt: 0 }, customer: { $ne: null } })).length;

  return Response.json({
    customers: rows,
    count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    owingCustomers,
  });
}

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseCustomerInput(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();

  if (parsed.data.phone && (await Customer.exists({ phone: parsed.data.phone }))) {
    return fail("A customer with this phone number already exists.", 409);
  }

  const customer = await Customer.create(parsed.data);
  return Response.json({ customer }, { status: 201 });
}
