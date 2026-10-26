import Product from "@/models/Product";
import Supplier from "@/models/Supplier";
import CashEntry from "@/models/CashEntry";
import { getSettings } from "@/models/Settings";
import { round2 } from "./money";
import { outstandingTotal } from "./stats";
import { statsForSuppliers } from "./supplierStats";
import { cashFigures } from "./reportData";

export async function stockValue() {
  const r = await Product.aggregate([
    { $match: { isActive: true, stock: { $gt: 0 } } },
    { $group: { _id: null, value: { $sum: { $multiply: ["$stock", "$costPrice"] } }, units: { $sum: "$stock" }, products: { $sum: 1 } } },
  ]);
  const a = r[0] || {};
  return { value: round2(a.value || 0), units: a.units || 0, products: a.products || 0 };
}

// What the business is worth right now:
//   goods in store (at cost) + cash/bank since you started + what customers owe you - what you owe suppliers
export async function buildWorth() {
  const settings = await getSettings();
  const [stock, owedToYou, suppliers] = await Promise.all([stockValue(), outstandingTotal(), Supplier.find().select("_id")]);
  const sStats = await statsForSuppliers(suppliers.map((s) => s._id));
  const owedToSuppliers = round2([...sStats.values()].reduce((n, s) => n + s.owing, 0));

  const out = {
    started: Boolean(settings.startedAt),
    startedAt: settings.startedAt,
    stock,
    owedToYou,
    owedToSuppliers,
  };
  if (!settings.startedAt) return out;

  const now = new Date();
  const f = await cashFigures(settings.startedAt, now);
  const cash = round2(f.totalIn - f.totalOut);
  const capital = await CashEntry.aggregate([
    { $match: { date: { $gte: settings.startedAt } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);
  const added = round2(capital.find((c) => c._id === "income")?.total || 0);
  const withdrawn = round2(capital.find((c) => c._id === "withdrawal")?.total || 0);

  const worth = round2(stock.value + cash + owedToYou - owedToSuppliers);
  const startingWorth = settings.startingStockValue;
  return {
    ...out,
    cash,
    moneyIn: f.totalIn,
    moneyOut: f.totalOut,
    worth,
    startingWorth,
    capitalAdded: added,
    withdrawn,
    // Growth with your own deposits and withdrawals taken out of the picture.
    growth: round2(worth - startingWorth - added + withdrawn),
  };
}
