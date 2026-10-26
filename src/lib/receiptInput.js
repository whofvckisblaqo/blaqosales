import { round2 } from "./money";
import { isValidId } from "./api";
import { EXPENSE_CATEGORIES } from "@/models/Expense";

// Validates the Receive Stock form. Returns { data } or { error }.
export function parseReceiptInput(body) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return { error: "Add at least one product that came in." };
  if (rawItems.length > 100) return { error: "Too many products in one delivery." };

  const seen = new Set();
  const items = [];
  for (const raw of rawItems) {
    if (!isValidId(raw.productId)) return { error: "Choose a product for every row." };
    if (seen.has(String(raw.productId))) {
      return { error: "The same product appears twice. Combine it into one row." };
    }
    seen.add(String(raw.productId));

    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return { error: "Quantity must be a whole number of 1 or more." };

    const unitCost = Number(raw.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) return { error: "Enter a valid cost for every product." };

    items.push({ productId: String(raw.productId), quantity, unitCost: round2(unitCost) });
  }

  const rawExpenses = Array.isArray(body.expenses) ? body.expenses : [];
  if (rawExpenses.length > 20) return { error: "Too many cost lines." };

  const expenses = [];
  for (const raw of rawExpenses) {
    const amountRaw = raw.amount === "" || raw.amount === null || raw.amount === undefined ? 0 : Number(raw.amount);
    if (!Number.isFinite(amountRaw) || amountRaw < 0) return { error: "Costs must be 0 or more." };
    if (amountRaw === 0) continue; // empty row, ignore

    const category = EXPENSE_CATEGORIES.includes(raw.category) ? raw.category : "Transport";
    const note = String(raw.note || "").trim().slice(0, 80);
    expenses.push({ category, name: note || category, amount: round2(amountRaw) });
  }

  let date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();

  const supplierId = isValidId(body.supplierId) ? String(body.supplierId) : null;
  const paidRaw = body.amountPaid === "" || body.amountPaid == null ? 0 : Number(body.amountPaid);
  if (!Number.isFinite(paidRaw) || paidRaw < 0) return { error: "Amount paid to the supplier must be 0 or more." };

  return {
    data: {
      supplierId,
      amountPaid: round2(paidRaw),
      date,
      items,
      expenses,
      method: body.method === "value" ? "value" : "quantity",
      note: String(body.note || "").trim().slice(0, 500),
    },
  };
}
