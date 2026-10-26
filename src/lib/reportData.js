import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import Expense from "@/models/Expense";
import Product from "@/models/Product";
import Payment from "@/models/Payment";
import StockReceipt from "@/models/StockReceipt";
import SupplierPayment from "@/models/SupplierPayment";
import CashEntry from "@/models/CashEntry";
import DayClosing from "@/models/DayClosing";
import { round2 } from "./money";
import { netItem } from "./itemNet";
import { NET_SALES, NET_COST, NET_PROFIT, outstandingTotal } from "./stats";
import { COUNTED_KINDS } from "./expenseFilters";
import { buildSaleQuery, sortFor } from "./saleFilters";
import { formatDate, formatTime, startOfDay, endOfDay, todayStr, monthStartStr, TIME_ZONE } from "./dates";

export const REPORT_TYPES = [
  "sales", "profit", "products", "customers", "best-sellers", "monthly", "closing", "cash-flow",
];

const ITEM_COLS = [
  { key: "item", label: "Item" },
  { key: "amount", label: "Amount", kind: "money", align: "right" },
];

const DAY = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: TIME_ZONE } });

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function eachDay(from, to) {
  const days = [];
  for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);
  return days;
}

// Reads ?from=&to= (defaults to this month so far).
export function readRange(sp) {
  let from = sp.get("from") || monthStartStr();
  let to = sp.get("to") || todayStr();
  if (!startOfDay(from) || !endOfDay(to)) return { error: "Choose a valid start and end date." };
  if (from > to) return { error: "The start date must be before the end date." };
  return { from, to, start: startOfDay(from), end: endOfDay(to) };
}

const rangeLabel = (from, to) => (from === to ? formatDate(startOfDay(from)) : `${formatDate(startOfDay(from))} to ${formatDate(startOfDay(to))}`);

// ---------- shared day-by-day figures ----------
async function dailyFigures(start, end) {
  const [sales, expenses] = await Promise.all([
    Sale.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: DAY("date"), orders: { $sum: 1 }, revenue: { $sum: NET_SALES }, cost: { $sum: NET_COST }, profit: { $sum: NET_PROFIT } } },
    ]),
    Expense.aggregate([
      { $match: { kind: { $in: COUNTED_KINDS }, date: { $gte: start, $lte: end } } },
      { $group: { _id: DAY("date"), total: { $sum: "$amount" } } },
    ]),
  ]);
  const map = new Map();
  for (const s of sales) map.set(s._id, { orders: s.orders, revenue: s.revenue, cost: s.cost, profit: s.profit, expenses: 0 });
  for (const e of expenses) {
    const row = map.get(e._id) || { orders: 0, revenue: 0, cost: 0, profit: 0, expenses: 0 };
    row.expenses = e.total;
    map.set(e._id, row);
  }
  return map;
}

function sumRows(rows, keys) {
  const t = {};
  for (const k of keys) t[k] = round2(rows.reduce((n, r) => n + (r[k] || 0), 0));
  return t;
}

// ---------- item level (products, best sellers) ----------
async function productRows(start, end) {
  const sales = await Sale.find({ date: { $gte: start, $lte: end } }).select("subtotal discount");
  const saleById = new Map(sales.map((s) => [String(s._id), s]));
  const items = await SaleItem.find({ sale: { $in: sales.map((s) => s._id) } });

  const by = new Map();
  for (const it of items) {
    const n = netItem(it, saleById.get(String(it.sale)));
    const key = String(it.product);
    const row = by.get(key) || { productId: key, product: it.productName, category: it.category, units: 0, revenue: 0, cost: 0, profit: 0 };
    row.units += n.qty;
    row.revenue += n.revenue;
    row.cost += n.cost;
    row.profit += n.profit;
    by.set(key, row);
  }
  const stock = new Map((await Product.find({ _id: { $in: [...by.keys()] } }).select("stock")).map((p) => [String(p._id), p.stock]));
  return [...by.values()].map((r) => ({
    ...r,
    revenue: round2(r.revenue),
    cost: round2(r.cost),
    profit: round2(r.profit),
    margin: r.revenue > 0 ? round2((r.profit / r.revenue) * 100) : 0,
    stock: stock.get(r.productId) ?? 0,
  }));
}

// ---------- the reports ----------
const BUILDERS = {
  async sales(sp) {
    // Sales history (used by the Sales page exports): one row per sale, same filters as the page.
    const query = await buildSaleQuery(sp);
    const sales = await Sale.find(query).sort(sortFor(sp.get("sort")));
    const items = await SaleItem.find({ sale: { $in: sales.map((s) => s._id) } });
    const bySale = new Map();
    for (const it of items) {
      const k = String(it.sale);
      if (!bySale.has(k)) bySale.set(k, []);
      bySale.get(k).push(it);
    }
    const rows = sales.map((s) => {
      const its = bySale.get(String(s._id)) || [];
      return {
        orderNumber: s.orderNumber,
        date: formatDate(s.date),
        time: formatTime(s.date),
        customer: s.customerName,
        phone: s.customerPhone,
        products: its.map((i) => `${i.productName} x${i.quantity}`).join("; "),
        qty: its.reduce((n, i) => n + i.quantity - (i.returnedQuantity || 0), 0),
        revenue: round2(s.subtotal - s.discount - (s.refundedRevenue || 0)),
        cost: round2(s.totalCost - (s.refundedCost || 0)),
        profit: round2(s.profit - (s.refundedProfit || 0)),
        paid: round2(s.amountPaid - (s.refundedAmount || 0)),
        balance: s.balance,
        method: s.paymentMethod,
        status: s.status === "completed" ? s.paymentStatus : s.status.replace("_", " "),
      };
    });
    const totals = sumRows(rows, ["qty", "revenue", "cost", "profit", "paid", "balance"]);
    return {
      type: "sales",
      title: "Sales history",
      subtitle: `${rows.length} sale${rows.length === 1 ? "" : "s"}`,
      summary: [
        { label: "Sales", value: rows.length, kind: "int" },
        { label: "Revenue", value: totals.revenue, kind: "money" },
        { label: "Profit", value: totals.profit, kind: "money", tone: "profit" },
        { label: "Outstanding", value: totals.balance, kind: "money", tone: totals.balance > 0 ? "danger" : undefined },
      ],
      columns: [
        { key: "orderNumber", label: "Order ID" },
        { key: "date", label: "Date" },
        { key: "time", label: "Time" },
        { key: "customer", label: "Customer" },
        { key: "products", label: "Products", wide: true },
        { key: "qty", label: "Qty", kind: "int", align: "right" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "cost", label: "Cost", kind: "money", align: "right" },
        { key: "profit", label: "Profit", kind: "money", align: "right" },
        { key: "paid", label: "Paid", kind: "money", align: "right" },
        { key: "balance", label: "Balance", kind: "money", align: "right" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: { orderNumber: "Total", ...totals },
    };
  },

  async profit(sp) {
    const r = readRange(sp);
    if (r.error) return r;
    const daily = await dailyFigures(r.start, r.end);
    const rows = eachDay(r.from, r.to)
      .map((d) => {
        const x = daily.get(d);
        if (!x) return null;
        return {
          date: formatDate(startOfDay(d)),
          revenue: round2(x.revenue),
          cost: round2(x.cost),
          gross: round2(x.profit),
          expenses: round2(x.expenses),
          net: round2(x.profit - x.expenses),
        };
      })
      .filter(Boolean);
    const totals = sumRows(rows, ["revenue", "cost", "gross", "expenses", "net"]);
    return {
      type: "profit",
      title: "Profit report",
      subtitle: rangeLabel(r.from, r.to),
      summary: [
        { label: "Revenue", value: totals.revenue, kind: "money" },
        { label: "Gross profit", value: totals.gross, kind: "money", tone: "profit" },
        { label: "Expenses", value: totals.expenses, kind: "money" },
        { label: "Net profit", value: totals.net, kind: "money", tone: totals.net < 0 ? "danger" : "profit" },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "cost", label: "Cost of goods", kind: "money", align: "right" },
        { key: "gross", label: "Gross profit", kind: "money", align: "right" },
        { key: "expenses", label: "Expenses", kind: "money", align: "right" },
        { key: "net", label: "Net profit", kind: "money", align: "right" },
      ],
      rows,
      totals: { date: "Total", ...totals },
      chart: { labels: rows.map((x) => x.date), a: rows.map((x) => x.revenue), b: rows.map((x) => x.net), aLabel: "Revenue", bLabel: "Net profit" },
    };
  },

  async products(sp) {
    const r = readRange(sp);
    if (r.error) return r;
    const rows = (await productRows(r.start, r.end)).sort((a, b) => b.profit - a.profit);
    const totals = sumRows(rows, ["units", "revenue", "cost", "profit"]);
    return {
      type: "products",
      title: "Product report",
      subtitle: rangeLabel(r.from, r.to),
      summary: [
        { label: "Products sold", value: rows.length, kind: "int" },
        { label: "Units", value: totals.units, kind: "int" },
        { label: "Revenue", value: totals.revenue, kind: "money" },
        { label: "Profit", value: totals.profit, kind: "money", tone: "profit" },
      ],
      columns: [
        { key: "product", label: "Product", wide: true },
        { key: "units", label: "Units sold", kind: "int", align: "right" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "cost", label: "Cost", kind: "money", align: "right" },
        { key: "profit", label: "Profit", kind: "money", align: "right" },
        { key: "margin", label: "Margin", kind: "pct", align: "right" },
        { key: "stock", label: "In stock now", kind: "int", align: "right" },
      ],
      rows,
      totals: { product: "Total", ...totals },
    };
  },

  async customers(sp) {
    const r = readRange(sp);
    if (r.error) return r;
    const sales = await Sale.find({ date: { $gte: r.start, $lte: r.end } });
    const by = new Map();
    for (const s of sales) {
      const key = s.customer ? String(s.customer) : "walkin";
      const row = by.get(key) || { customer: s.customer ? s.customerName : "Walk-in customers", phone: s.customerPhone || "", orders: 0, revenue: 0, profit: 0, balance: 0, last: null };
      row.orders += 1;
      row.revenue += s.subtotal - s.discount - (s.refundedRevenue || 0);
      row.profit += s.profit - (s.refundedProfit || 0);
      row.balance += s.balance;
      if (!row.last || s.date > row.last) row.last = s.date;
      by.set(key, row);
    }
    const rows = [...by.values()]
      .map((x) => ({ ...x, revenue: round2(x.revenue), profit: round2(x.profit), balance: round2(x.balance), last: formatDate(x.last) }))
      .sort((a, b) => b.revenue - a.revenue);
    const totals = sumRows(rows, ["orders", "revenue", "profit", "balance"]);
    return {
      type: "customers",
      title: "Customer report",
      subtitle: rangeLabel(r.from, r.to),
      summary: [
        { label: "Customers", value: rows.length, kind: "int" },
        { label: "Orders", value: totals.orders, kind: "int" },
        { label: "Revenue", value: totals.revenue, kind: "money" },
        { label: "Outstanding", value: totals.balance, kind: "money", tone: totals.balance > 0 ? "danger" : undefined },
      ],
      columns: [
        { key: "customer", label: "Customer", wide: true },
        { key: "phone", label: "Phone" },
        { key: "orders", label: "Orders", kind: "int", align: "right" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "profit", label: "Profit", kind: "money", align: "right" },
        { key: "balance", label: "Owes", kind: "money", align: "right" },
        { key: "last", label: "Last purchase" },
      ],
      rows,
      totals: { customer: "Total", ...totals },
    };
  },

  async "best-sellers"(sp) {
    const r = readRange(sp);
    if (r.error) return r;
    const rank = ["units", "revenue", "profit"].includes(sp.get("rank")) ? sp.get("rank") : "units";
    const all = (await productRows(r.start, r.end)).sort((a, b) => b[rank] - a[rank] || b.profit - a.profit);
    const rows = all.slice(0, 20).map((x, i) => ({ rank: i + 1, ...x }));
    const label = { units: "units sold", revenue: "revenue", profit: "profit" }[rank];
    return {
      type: "best-sellers",
      title: "Best sellers",
      subtitle: `${rangeLabel(r.from, r.to)} · ranked by ${label}`,
      summary: rows[0]
        ? [
            { label: "Top product", value: rows[0].product, kind: "text" },
            { label: "Units", value: rows[0].units, kind: "int" },
            { label: "Revenue", value: rows[0].revenue, kind: "money" },
            { label: "Profit", value: rows[0].profit, kind: "money", tone: "profit" },
          ]
        : [],
      columns: [
        { key: "rank", label: "#", kind: "int" },
        { key: "product", label: "Product", wide: true },
        { key: "units", label: "Units sold", kind: "int", align: "right" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "profit", label: "Profit", kind: "money", align: "right" },
        { key: "margin", label: "Margin", kind: "pct", align: "right" },
      ],
      rows,
      totals: null,
      chart: { labels: rows.map((x) => x.product), a: rows.map((x) => x[rank]), aLabel: label },
    };
  },

  async monthly(sp) {
    const month = /^\d{4}-\d{2}$/.test(sp.get("month") || "") ? sp.get("month") : todayStr().slice(0, 7);
    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${month}-${String(last).padStart(2, "0")}`;
    const start = startOfDay(from);
    const end = endOfDay(to);

    const [daily, products, outstanding] = await Promise.all([dailyFigures(start, end), productRows(start, end), outstandingTotal()]);
    const rows = eachDay(from, to).map((d) => {
      const x = daily.get(d) || { orders: 0, revenue: 0, cost: 0, profit: 0, expenses: 0 };
      return {
        date: formatDate(startOfDay(d)),
        orders: x.orders,
        revenue: round2(x.revenue),
        profit: round2(x.profit),
        expenses: round2(x.expenses),
        net: round2(x.profit - x.expenses),
      };
    });
    const totals = sumRows(rows, ["orders", "revenue", "profit", "expenses", "net"]);
    const top = [...products].sort((a, b) => b.units - a.units)[0];
    const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return {
      type: "monthly",
      title: `Monthly summary - ${monthName}`,
      subtitle: monthName,
      month,
      summary: [
        { label: "Revenue", value: totals.revenue, kind: "money" },
        { label: "Gross profit", value: totals.profit, kind: "money", tone: "profit" },
        { label: "Expenses", value: totals.expenses, kind: "money" },
        { label: "Net profit", value: totals.net, kind: "money", tone: totals.net < 0 ? "danger" : "profit" },
        { label: "Orders", value: totals.orders, kind: "int" },
        { label: "Units sold", value: products.reduce((n, p) => n + p.units, 0), kind: "int" },
        { label: "Best seller", value: top ? `${top.product} (${top.units})` : "-", kind: "text" },
        { label: "Outstanding now", value: outstanding, kind: "money", tone: outstanding > 0 ? "danger" : undefined },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "orders", label: "Orders", kind: "int", align: "right" },
        { key: "revenue", label: "Revenue", kind: "money", align: "right" },
        { key: "profit", label: "Gross profit", kind: "money", align: "right" },
        { key: "expenses", label: "Expenses", kind: "money", align: "right" },
        { key: "net", label: "Net profit", kind: "money", align: "right" },
      ],
      rows,
      totals: { date: "Total", ...totals },
      chart: { labels: rows.map((x) => x.date.slice(0, 5)), a: rows.map((x) => x.revenue), b: rows.map((x) => x.net), aLabel: "Revenue", bLabel: "Net profit" },
    };
  },

  async closing(sp) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("day") || "") ? sp.get("day") : todayStr();
    const start = startOfDay(day);
    const end = endOfDay(day);
    const f = await closingFigures(start, end);
    const saved = await DayClosing.findOne({ day });
    const counted = saved?.countedCash ?? null;
    return {
      type: "closing",
      title: `Daily closing - ${formatDate(start)}`,
      subtitle: formatDate(start),
      day,
      closed: saved ? { closedAt: saved.closedAt, countedCash: saved.countedCash, note: saved.note } : null,
      summary: [
        { label: "Orders", value: f.orders, kind: "int" },
        { label: "Revenue", value: f.revenue, kind: "money" },
        { label: "Gross profit", value: f.profit, kind: "money", tone: "profit" },
        { label: "Expenses", value: f.expenses, kind: "money" },
        { label: "Net profit", value: round2(f.profit - f.expenses), kind: "money", tone: f.profit - f.expenses < 0 ? "danger" : "profit" },
        { label: "Money received", value: f.moneyIn, kind: "money" },
        { label: "Money paid out", value: f.moneyOut, kind: "money" },
        { label: "Expected cash in hand", value: f.expectedCash, kind: "money" },
      ],
      columns: [
        { key: "item", label: "Item" },
        { key: "amount", label: "Amount", kind: "money", align: "right" },
      ],
      rows: f.lines,
      totals: null,
      extra: { expectedCash: f.expectedCash, countedCash: counted, difference: counted === null ? null : round2(counted - f.expectedCash) },
    };
  },

  async "cash-flow"(sp) {
    const r = readRange(sp);
    if (r.error) return r;
    const f = await cashFigures(r.start, r.end);
    const rows = eachDay(r.from, r.to)
      .map((d) => {
        const x = f.byDay.get(d);
        if (!x) return null;
        return { date: formatDate(startOfDay(d)), moneyIn: round2(x.in), moneyOut: round2(x.out), net: round2(x.in - x.out) };
      })
      .filter(Boolean);
    return {
      type: "cash-flow",
      title: "Cash flow",
      subtitle: rangeLabel(r.from, r.to),
      summary: [
        { label: "Money in", value: f.totalIn, kind: "money", tone: "profit" },
        { label: "Money out", value: f.totalOut, kind: "money" },
        { label: "Net cash flow", value: round2(f.totalIn - f.totalOut), kind: "money", tone: f.totalIn - f.totalOut < 0 ? "danger" : "profit" },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "moneyIn", label: "Money in", kind: "money", align: "right" },
        { key: "moneyOut", label: "Money out", kind: "money", align: "right" },
        { key: "net", label: "Net", kind: "money", align: "right" },
      ],
      rows,
      totals: { date: "Total", moneyIn: f.totalIn, moneyOut: f.totalOut, net: round2(f.totalIn - f.totalOut) },
      extra: { entries: f.entries },
      extraTables: [
        { title: "Where the money came from", columns: ITEM_COLS, rows: f.inLines },
        { title: "Where the money went", columns: ITEM_COLS, rows: f.outLines },
      ],
      chart: { labels: rows.map((x) => x.date.slice(0, 5)), a: rows.map((x) => x.moneyIn), b: rows.map((x) => x.moneyOut), aLabel: "Money in", bLabel: "Money out" },
    };
  },
};

// ---------- cash movements ----------
export async function cashFigures(start, end) {
  const [pay, exp, receipts, supPay, cash] = await Promise.all([
    Payment.find({ date: { $gte: start, $lte: end } }),
    Expense.find({ date: { $gte: start, $lte: end } }),
    StockReceipt.find({ date: { $gte: start, $lte: end }, amountPaid: { $gt: 0 } }),
    SupplierPayment.find({ date: { $gte: start, $lte: end } }),
    CashEntry.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }),
  ]);

  const byDay = new Map();
  const day = (d) => new Date(new Date(d).getTime() + 3600000).toISOString().slice(0, 10);
  const add = (d, key, amt) => {
    const k = day(d);
    const x = byDay.get(k) || { in: 0, out: 0 };
    x[key] += amt;
    byDay.set(k, x);
  };

  const inL = { salePayments: 0, debtPayments: 0, otherIncome: 0 };
  const outL = { operating: 0, delivery: 0, supplierGoods: 0, supplierPayments: 0, refunds: 0, withdrawals: 0 };

  for (const p of pay) {
    if (p.type === "refund") {
      outL.refunds += p.amount;
      add(p.date, "out", p.amount);
    } else {
      if (p.source === "debt") inL.debtPayments += p.amount;
      else inL.salePayments += p.amount;
      add(p.date, "in", p.amount);
    }
  }
  for (const e of exp) {
    if (e.kind === "inbound") outL.delivery += e.amount;
    else outL.operating += e.amount;
    add(e.date, "out", e.amount);
  }
  for (const r of receipts) {
    outL.supplierGoods += r.amountPaid;
    add(r.date, "out", r.amountPaid);
  }
  for (const s of supPay) {
    outL.supplierPayments += s.amount;
    add(s.date, "out", s.amount);
  }
  for (const c of cash) {
    if (c.type === "income") {
      inL.otherIncome += c.amount;
      add(c.date, "in", c.amount);
    } else {
      outL.withdrawals += c.amount;
      add(c.date, "out", c.amount);
    }
  }

  const totalIn = round2(Object.values(inL).reduce((n, v) => n + v, 0));
  const totalOut = round2(Object.values(outL).reduce((n, v) => n + v, 0));
  const inLines = [
    { item: "Customer payments at time of sale", amount: round2(inL.salePayments) },
    { item: "Debt payments received", amount: round2(inL.debtPayments) },
    { item: "Other income", amount: round2(inL.otherIncome) },
  ];
  const outLines = [
    { item: "Business expenses and bagging", amount: round2(outL.operating) },
    { item: "Transport/delivery of goods", amount: round2(outL.delivery) },
    { item: "Goods paid for on delivery", amount: round2(outL.supplierGoods) },
    { item: "Payments to suppliers", amount: round2(outL.supplierPayments) },
    { item: "Refunds to customers", amount: round2(outL.refunds) },
    { item: "Owner withdrawals", amount: round2(outL.withdrawals) },
  ];
  return {
    totalIn, totalOut, byDay, inLines, outLines,
    entries: cash.map((c) => ({ _id: String(c._id), type: c.type, name: c.name, amount: c.amount, date: formatDate(c.date), note: c.note })),
    raw: { pay, exp, receipts, supPay, cash },
  };
}

async function closingFigures(start, end) {
  const [sales, f] = await Promise.all([
    Sale.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: NET_SALES }, profit: { $sum: NET_PROFIT } } },
    ]),
    cashFigures(start, end),
  ]);
  const s = sales[0] || {};
  const expenses = round2(f.raw.exp.filter((e) => COUNTED_KINDS.includes(e.kind)).reduce((n, e) => n + e.amount, 0));

  // Cash in hand: only the physical-cash movements.
  const cashIn =
    f.raw.pay.filter((p) => p.type !== "refund" && p.method === "cash").reduce((n, p) => n + p.amount, 0) +
    f.raw.cash.filter((c) => c.type === "income").reduce((n, c) => n + c.amount, 0);
  const cashOut =
    f.raw.pay.filter((p) => p.type === "refund" && p.method === "cash").reduce((n, p) => n + p.amount, 0) +
    f.raw.exp.filter((e) => e.paymentMethod === "cash").reduce((n, e) => n + e.amount, 0) +
    f.raw.supPay.filter((p) => p.method === "cash").reduce((n, p) => n + p.amount, 0) +
    f.raw.receipts.reduce((n, r) => n + r.amountPaid, 0) +
    f.raw.cash.filter((c) => c.type === "withdrawal").reduce((n, c) => n + c.amount, 0);

  const methodLines = ["cash", "transfer", "pos", "card", "other"].map((m) => ({
    item: `Received by ${m === "pos" ? "POS" : m}`,
    amount: round2(f.raw.pay.filter((p) => p.type !== "refund" && p.method === m).reduce((n, p) => n + p.amount, 0)),
  }));

  return {
    orders: s.orders || 0,
    revenue: round2(s.revenue || 0),
    profit: round2(s.profit || 0),
    expenses,
    moneyIn: f.totalIn,
    moneyOut: f.totalOut,
    expectedCash: round2(cashIn - cashOut),
    lines: [
      ...methodLines,
      ...f.inLines.filter((l) => l.amount > 0).map((l) => ({ item: `In: ${l.item}`, amount: l.amount })),
      ...f.outLines.filter((l) => l.amount > 0).map((l) => ({ item: `Out: ${l.item}`, amount: l.amount })),
    ],
  };
}

export async function buildReport(type, searchParams) {
  const fn = BUILDERS[type];
  if (!fn) return { error: "Unknown report." };
  return fn(searchParams);
}

