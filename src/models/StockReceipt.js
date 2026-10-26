import mongoose from "mongoose";
import { EXPENSE_CATEGORIES } from "./Expense";

// One delivery of goods: what came in, what it cost, and what it cost to bring in.
const ReceiptItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 }, // supplier price per item
    goodsCost: { type: Number, required: true, min: 0 },
    expenseShare: { type: Number, required: true, min: 0 }, // share of transport etc.
    lineTotal: { type: Number, required: true, min: 0 },
    landedUnitCost: { type: Number, required: true, min: 0 }, // unitCost + share per item
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    previousCost: { type: Number, required: true },
    newCost: { type: Number, required: true }, // product cost price after blending
  },
  { _id: false }
);

const ReceiptExpenseSchema = new mongoose.Schema(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Transport" },
    name: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const StockReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    items: { type: [ReceiptItemSchema], default: [] },
    expenses: { type: [ReceiptExpenseSchema], default: [] },
    method: { type: String, enum: ["quantity", "value"], default: "quantity" },
    goodsTotal: { type: Number, required: true },
    expensesTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    note: { type: String, default: "" },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    supplierName: { type: String, default: "" },
    // What you paid the supplier for the goods on this delivery.
    amountPaid: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.StockReceipt || mongoose.model("StockReceipt", StockReceiptSchema);
