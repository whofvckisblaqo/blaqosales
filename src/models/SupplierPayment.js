import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Sale";

// Money you paid a supplier outside of a delivery (settling what you owe).
const SupplierPaymentSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    date: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.SupplierPayment || mongoose.model("SupplierPayment", SupplierPaymentSchema);
