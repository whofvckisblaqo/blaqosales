import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Sale";

// Every naira that moves in or out against a sale. "payment" = money in
// (including later debt payments), "refund" = money back to the customer.
const PaymentSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    type: { type: String, enum: ["payment", "refund"], default: "payment" },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    date: { type: Date, default: Date.now, index: true },
    reference: { type: String, default: "" },
    // "sale" = paid at the time of sale, "debt" = paid later.
    source: { type: String, enum: ["sale", "debt", "refund"], default: "sale" },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
