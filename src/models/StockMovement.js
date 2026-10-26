import mongoose from "mongoose";

export const STOCK_MOVEMENT_TYPES = [
  "initial",
  "restock",
  "sale",
  "sale_edit",
  "sale_delete",
  "refund_return",
  "adjustment_in",
  "adjustment_out",
];

const StockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    // Signed: negative when stock goes down, positive when it goes up.
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, default: "" },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null },
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: "StockReceipt", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.models.StockMovement || mongoose.model("StockMovement", StockMovementSchema);
