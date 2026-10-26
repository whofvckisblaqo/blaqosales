import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Sale";

export const EXPENSE_CATEGORIES = [
  "Delivery",
  "Transport",
  "Rent",
  "Electricity",
  "Internet",
  "Advertising",
  "Packaging",
  "Staff",
  "Supplier",
  "Miscellaneous",
];

// kind:
//   operating - normal business expense, comes off profit (default)
//   packaging - bagging cost recorded with a sale, comes off profit
//   inbound   - cost of bringing goods in. It is already inside the products'
//               cost price, so it is NOT subtracted from profit again.
//               It still counts as money going out in cash flow.
export const EXPENSE_KINDS = ["operating", "packaging", "inbound"];

const ExpenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Miscellaneous" },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true, default: Date.now, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    description: { type: String, default: "" },
    receipt: { type: String, default: "" },
    kind: { type: String, enum: EXPENSE_KINDS, default: "operating", index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    stockReceipt: { type: mongoose.Schema.Types.ObjectId, ref: "StockReceipt", default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
