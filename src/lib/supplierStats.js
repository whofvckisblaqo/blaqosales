import StockReceipt from "@/models/StockReceipt";
import SupplierPayment from "@/models/SupplierPayment";
import { round2 } from "./money";

// Purchased / paid / owing for suppliers. Always worked out from the deliveries and
// payments themselves, so it cannot drift.
export async function statsForSuppliers(ids) {
  const out = new Map();
  if (ids.length === 0) return out;

  const [receipts, payments] = await Promise.all([
    StockReceipt.aggregate([
      { $match: { supplier: { $in: ids } } },
      {
        $group: {
          _id: "$supplier",
          purchased: { $sum: "$goodsTotal" },
          paidOnDelivery: { $sum: "$amountPaid" },
          deliveries: { $sum: 1 },
          last: { $max: "$date" },
        },
      },
    ]),
    SupplierPayment.aggregate([
      { $match: { supplier: { $in: ids } } },
      { $group: { _id: "$supplier", paid: { $sum: "$amount" } } },
    ]),
  ]);

  for (const id of ids) out.set(String(id), { purchased: 0, paid: 0, owing: 0, deliveries: 0, lastDelivery: null });
  for (const r of receipts) {
    const o = out.get(String(r._id));
    o.purchased = round2(r.purchased);
    o.paid = round2(r.paidOnDelivery);
    o.deliveries = r.deliveries;
    o.lastDelivery = r.last;
  }
  for (const p of payments) {
    const o = out.get(String(p._id));
    o.paid = round2(o.paid + p.paid);
  }
  for (const o of out.values()) o.owing = round2(Math.max(o.purchased - o.paid, 0));
  return out;
}
