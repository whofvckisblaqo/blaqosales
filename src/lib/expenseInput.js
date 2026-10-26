import { round2 } from "./money";
import { noonOf } from "./dates";
import { EXPENSE_CATEGORIES } from "@/models/Expense";
import { PAYMENT_METHODS } from "@/models/Sale";

// Validates the expense form. Returns { data } or { error }.
export function parseExpenseInput(body) {
  const name = String(body.name || "").trim();
  if (!name) return { error: "Enter what the expense was for." };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above 0." };

  const category = EXPENSE_CATEGORIES.includes(body.category) ? body.category : "Miscellaneous";
  const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : "cash";

  const date = (body.date && noonOf(String(body.date))) || new Date();

  return {
    data: {
      name: name.slice(0, 120),
      category,
      amount: round2(amount),
      date,
      paymentMethod,
      description: String(body.description || "").trim().slice(0, 500),
    },
  };
}
