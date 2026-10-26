import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import Expense from "@/models/Expense";
import { round2 } from "./money";
import { COUNTED_KINDS } from "./expenseFilters";

// Definitions used across the whole app:
//   sales    = money from the goods sold (subtotal - discount). Delivery fees are not sales.
//   profit   = sales - cost of goods sold (gross profit)
//   expenses = business expenses and bagging. Delivery costs are already inside product cost.
//   net      = profit - expenses

// Aggregation expressions that already take refunds into account.
export const NET_SALES = {
  $subtract: [{ $subtract: ["$subtotal", "$discount"] }, { $ifNull: ["$refundedRevenue", 0] }],
};
export const NET_COST = { $subtract: ["$totalCost", { $ifNull: ["$refundedCost", 0] }] };
export const NET_PROFIT = { $subtract: ["$profit", { $ifNull: ["$refundedProfit", 0] }] };

export async function salesTotals(from, to) {
  const r = await Sale.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        sales: { $sum: NET_SALES },
        profit: { $sum: NET_PROFIT },
        orders: { $sum: 1 },
      },
    },
  ]);
  const a = r[0] || {};
  return { sales: round2(a.sales || 0), profit: round2(a.profit || 0), orders: a.orders || 0 };
}

export async function expenseTotal(from, to) {
  const r = await Expense.aggregate([
    { $match: { kind: { $in: COUNTED_KINDS }, date: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return round2(r[0]?.total || 0);
}

export async function productsSold(from, to) {
  const saleIds = await Sale.distinct("_id", { date: { $gte: from, $lte: to } });
  if (saleIds.length === 0) return 0;
  const r = await SaleItem.aggregate([
    { $match: { sale: { $in: saleIds } } },
    { $group: { _id: null, qty: { $sum: { $subtract: ["$quantity", { $ifNull: ["$returnedQuantity", 0] }] } } } },
  ]);
  return r[0]?.qty || 0;
}

export async function outstandingTotal() {
  const r = await Sale.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
  return round2(r[0]?.total || 0);
}
