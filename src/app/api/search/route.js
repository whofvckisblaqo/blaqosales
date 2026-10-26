import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Supplier from "@/models/Supplier";
import Sale from "@/models/Sale";
import { requireUser, unauthorized, escapeRegex } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";

// One search box for everything: products, customers, sales/orders and suppliers.
export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ results: [] });

  await connectDB();
  const rx = new RegExp(escapeRegex(q), "i");
  const [products, customers, sales, suppliers] = await Promise.all([
    Product.find({ isActive: true, $or: [{ name: rx }, { brand: rx }, { sku: rx }] }).limit(5),
    Customer.find({ $or: [{ name: rx }, { phone: rx }] }).limit(5),
    Sale.find({ $or: [{ orderNumber: rx }, { customerName: rx }, { customerPhone: rx }] }).sort({ date: -1 }).limit(5),
    Supplier.find({ $or: [{ name: rx }, { phone: rx }] }).limit(5),
  ]);

  const results = [
    ...products.map((p) => ({ id: `p-${p._id}`, group: "Products", title: p.label, text: `${p.stock} in stock`, href: `/products?q=${encodeURIComponent(p.name)}` })),
    ...customers.map((c) => ({ id: `c-${c._id}`, group: "Customers", title: c.name, text: c.phone || "No phone", href: `/customers/${c._id}` })),
    ...sales.map((s) => ({ id: `s-${s._id}`, group: "Sales", title: s.orderNumber, text: `${s.customerName} · ${formatNaira(s.total)} · ${formatDate(s.date)}`, href: `/sales?q=${encodeURIComponent(s.orderNumber)}` })),
    ...suppliers.map((s) => ({ id: `u-${s._id}`, group: "Suppliers", title: s.name, text: s.phone || "No phone", href: `/suppliers/${s._id}` })),
  ];
  return Response.json({ results });
}
