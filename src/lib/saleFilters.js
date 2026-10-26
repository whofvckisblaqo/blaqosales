import SaleItem from "@/models/SaleItem";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/models/Sale";
import { escapeRegex, isValidId } from "./api";
import { startOfDay, endOfDay } from "./dates";

// Turns the filter query string into a MongoDB query. Shared by the list and export.
export async function buildSaleQuery(searchParams) {
  const query = {};
  const and = [];

  const q = (searchParams.get("q") || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const salesWithProduct = await SaleItem.distinct("sale", { productName: rx });
    and.push({
      $or: [{ orderNumber: rx }, { customerName: rx }, { customerPhone: rx }, { _id: { $in: salesWithProduct } }],
    });
  }

  const product = searchParams.get("product");
  if (product && isValidId(product)) {
    const ids = await SaleItem.distinct("sale", { product });
    and.push({ _id: { $in: ids } });
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = {};
  if (from && startOfDay(from)) range.$gte = startOfDay(from);
  if (to && endOfDay(to)) range.$lte = endOfDay(to);
  if (Object.keys(range).length) query.date = range;

  const method = searchParams.get("method");
  if (PAYMENT_METHODS.includes(method)) query.paymentMethod = method;

  const status = searchParams.get("status");
  if (PAYMENT_STATUSES.includes(status)) query.paymentStatus = status;
  if (status === "overdue") {
    query.balance = { $gt: 0 };
    query.dueDate = { $lt: new Date() };
  }

  if (and.length) query.$and = and;
  return query;
}

export function sortFor(value) {
  switch (value) {
    case "oldest":
      return { date: 1 };
    case "highest":
      return { total: -1, date: -1 };
    case "lowest":
      return { total: 1, date: -1 };
    default:
      return { date: -1 };
  }
}
