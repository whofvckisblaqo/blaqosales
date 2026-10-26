import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Sale";

const RefundItemSchema = new mongoose.Schema(
  {
    saleItem: { type: mongoose.Schema.Types.ObjectId, ref: "SaleItem", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    restock: { type: Boolean, default: true },
    revenue: { type: Number, required: true, min: 0 }, // value refunded after discount share
    cost: { type: Number, required: true, min: 0 }, // cost recovered (only if restocked)
  },
  { _id: false }
);

const RefundSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    orderNumber: { type: String, required: true },
    date: { type: Date, default: Date.now, index: true },
    items: { type: [RefundItemSchema], default: [] },
    revenue: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    // Cash handed back. 0 when the refund only reduces what the customer owes.
    cashRefunded: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Refund || mongoose.model("Refund", RefundSchema);
