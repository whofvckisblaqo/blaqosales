import connectDB from "@/lib/mongodb";
import Supplier from "@/models/Supplier";
import StockReceipt from "@/models/StockReceipt";
import SupplierPayment from "@/models/SupplierPayment";
import Product from "@/models/Product";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { statsForSuppliers } from "@/lib/supplierStats";
import { parseSupplier } from "@/lib/supplierInput";

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Supplier not found.", 404);

  await connectDB();
  const supplier = await Supplier.findById(id);
  if (!supplier) return fail("Supplier not found.", 404);

  const [stats, receipts, payments, products] = await Promise.all([
    statsForSuppliers([supplier._id]),
    StockReceipt.find({ supplier: id }).sort({ date: -1 }).limit(100),
    SupplierPayment.find({ supplier: id }).sort({ date: -1 }).limit(100),
    Product.find({ supplier: id, isActive: true }).select("name size stock costPrice"),
  ]);

  // Products that arrived in this supplier's deliveries, plus products assigned to them.
  const supplied = new Map();
  for (const p of products) supplied.set(String(p._id), { _id: p._id, name: p.label, stock: p.stock });
  for (const r of receipts) {
    for (const it of r.items) {
      const key = String(it.product);
      if (!supplied.has(key)) supplied.set(key, { _id: it.product, name: it.productName, stock: null });
    }
  }

  return Response.json({
    supplier: { ...supplier.toJSON(), ...stats.get(String(supplier._id)) },
    receipts: receipts.map((r) => ({
      _id: r._id,
      receiptNumber: r.receiptNumber,
      date: r.date,
      goodsTotal: r.goodsTotal,
      expensesTotal: r.expensesTotal,
      amountPaid: r.amountPaid,
      items: r.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitCost: i.unitCost })),
    })),
    payments,
    products: [...supplied.values()],
  });
}

export async function PUT(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Supplier not found.", 404);
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");
  const parsed = parseSupplier(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();
  const supplier = await Supplier.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
  if (!supplier) return fail("Supplier not found.", 404);
  // Keep the name on past deliveries in step.
  await StockReceipt.updateMany({ supplier: id }, { $set: { supplierName: supplier.name } });
  return Response.json({ supplier });
}

// A supplier you still owe money to cannot be deleted. Others are removed;
// their old deliveries keep the supplier's name.
export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Supplier not found.", 404);

  await connectDB();
  const supplier = await Supplier.findById(id);
  if (!supplier) return fail("Supplier not found.", 404);

  const stats = (await statsForSuppliers([supplier._id])).get(String(supplier._id));
  if (stats.owing > 0) return fail("You still owe this supplier money. Record the payment first.");

  await Promise.all([
    Product.updateMany({ supplier: id }, { $set: { supplier: null } }),
    StockReceipt.updateMany({ supplier: id }, { $set: { supplier: null, supplierName: supplier.name } }),
    SupplierPayment.deleteMany({ supplier: id }),
  ]);
  await supplier.deleteOne();
  return Response.json({ deleted: true });
}
