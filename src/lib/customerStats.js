import Sale from "@/models/Sale";
import { round2 } from "./money";

// Orders, total spent, what they owe and the last purchase. Always worked out
// from the sales themselves, so the figures can never go out of date.
export async function statsForCustomers(ids) {
  if (ids.length === 0) return new Map();

  const rows = await Sale.aggregate([
    { $match: { customer: { $in: ids } } },
    {
      $group: {
        _id: "$customer",
        orders: { $sum: 1 },
        spent: { $sum: { $subtract: ["$total", { $ifNull: ["$refundedRevenue", 0] }] } },
        balance: { $sum: "$balance" },
        lastPurchase: { $max: "$date" },
      },
    },
  ]);

  return new Map(
    rows.map((r) => [
      String(r._id),
      { orders: r.orders, spent: round2(r.spent), balance: round2(r.balance), lastPurchase: r.lastPurchase },
    ])
  );
}

export const EMPTY_STATS = { orders: 0, spent: 0, balance: 0, lastPurchase: null };
