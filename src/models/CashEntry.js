import mongoose from "mongoose";

// Money in or out that is not a sale or an expense, e.g. capital put in or an owner withdrawal.
const CashEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["income", "withdrawal"], required: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.CashEntry || mongoose.model("CashEntry", CashEntrySchema);
