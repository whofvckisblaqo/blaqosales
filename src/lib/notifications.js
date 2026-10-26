import Product from "@/models/Product";
import Sale from "@/models/Sale";
import Expense from "@/models/Expense";
import Supplier from "@/models/Supplier";
import { getSettings } from "@/models/Settings";
import { formatNaira, round2 } from "./money";
import { statsForSuppliers } from "./supplierStats";
import { salesTotals } from "./stats";
import { startOfDay, endOfDay, monthStartStr, todayStr, formatDate } from "./dates";

export const MILESTONES = [100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];

// Works out what needs attention right now. Nothing is stored, so it is always current.
export async function buildNotifications() {
  const settings = await getSettings();
  const now = new Date();
  const items = [];

  const [outOfStock, lowStock, owing, overdue, bigExpenses, suppliers, month] = await Promise.all([
    Product.find({ isActive: true, stock: { $lte: 0 } }).select("name size stock").limit(50),
    Product.find({ isActive: true, stock: { $gt: 0 }, $expr: { $lte: ["$stock", "$lowStockThreshold"] } }).select("name size stock lowStockThreshold").limit(50),
    Sale.aggregate([{ $match: { balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$balance" }, count: { $sum: 1 } } }]),
    Sale.find({ balance: { $gt: 0 }, dueDate: { $lt: now } }).sort({ dueDate: 1 }).limit(20),
    settings.largeExpenseThreshold > 0
      ? Expense.find({ amount: { $gte: settings.largeExpenseThreshold }, date: { $gte: new Date(now.getTime() - 7 * 86400000) } }).sort({ date: -1 }).limit(10)
      : [],
    Supplier.find().select("name"),
    salesTotals(startOfDay(monthStartStr()), endOfDay(todayStr())),
  ]);

  for (const p of outOfStock) {
    items.push({ id: `oos-${p._id}`, level: "danger", title: `${p.label} is out of stock`, text: "Receive more stock before you can sell it.", href: "/products/receive" });
  }
  for (const p of lowStock) {
    items.push({ id: `low-${p._id}`, level: "warning", title: `${p.label} is running low`, text: `Only ${p.stock} left (alert at ${p.lowStockThreshold}).`, href: "/products/receive" });
  }
  for (const s of overdue) {
    items.push({ id: `od-${s._id}`, level: "danger", title: `${s.customerName} is overdue`, text: `${s.orderNumber}: ${formatNaira(s.balance)} was due ${formatDate(s.dueDate)}.`, href: "/customers" });
  }
  const o = owing[0];
  if (o && o.count > 0) {
    items.push({ id: "unpaid", level: "warning", title: `${formatNaira(round2(o.total))} still owed to you`, text: `${o.count} sale${o.count === 1 ? " is" : "s are"} unpaid or part-paid.`, href: "/customers" });
  }

  const stats = await statsForSuppliers(suppliers.map((s) => s._id));
  const byId = new Map(suppliers.map((s) => [String(s._id), s]));
  for (const [id, st] of stats) {
    if (st.owing > 0) {
      items.push({ id: `sup-${id}`, level: "warning", title: `You owe ${byId.get(id).name} ${formatNaira(st.owing)}`, text: "Record the payment once you have paid.", href: `/suppliers/${id}` });
    }
  }
  for (const e of bigExpenses) {
    items.push({ id: `exp-${e._id}`, level: "info", title: `Large expense: ${e.name}`, text: `${formatNaira(e.amount)} on ${formatDate(e.date)}.`, href: "/expenses" });
  }

  const reached = [...MILESTONES].reverse().find((m) => month.sales >= m);
  if (reached) {
    items.push({ id: `ms-${monthStartStr()}-${reached}`, level: "success", title: `${formatNaira(reached)} in sales this month`, text: `You have sold ${formatNaira(month.sales)} so far. Well done!`, href: "/reports" });
  }

  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  return { items, count: items.filter((i) => i.level === "danger" || i.level === "warning").length };
}
