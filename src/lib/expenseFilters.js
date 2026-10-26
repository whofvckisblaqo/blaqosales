import { EXPENSE_CATEGORIES } from "@/models/Expense";
import { PAYMENT_METHODS } from "@/models/Sale";
import { escapeRegex } from "./api";
import { startOfDay, endOfDay } from "./dates";

// Expenses that come off profit. "inbound" delivery costs are not here because
// they are already inside the products' cost price.
export const COUNTED_KINDS = ["operating", "packaging"];

export function buildExpenseQuery(searchParams, { ignoreKind = false } = {}) {
  const query = {};

  const q = (searchParams.get("q") || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    query.$or = [{ name: rx }, { description: rx }];
  }

  const category = searchParams.get("category");
  if (EXPENSE_CATEGORIES.includes(category)) query.category = category;

  const method = searchParams.get("method");
  if (PAYMENT_METHODS.includes(method)) query.paymentMethod = method;

  if (!ignoreKind) {
    const kind = searchParams.get("kind");
    if (kind === "business") query.kind = { $in: COUNTED_KINDS };
    if (kind === "delivery") query.kind = "inbound";
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = {};
  if (from && startOfDay(from)) range.$gte = startOfDay(from);
  if (to && endOfDay(to)) range.$lte = endOfDay(to);
  if (Object.keys(range).length) query.date = range;

  return query;
}
