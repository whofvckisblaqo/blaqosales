import mongoose from "mongoose";
import { round2 } from "@/lib/money";

// SaleItem stores a SNAPSHOT of cost and selling price at the moment of sale.
// Changing a product's price later never changes this record or its profit.
const SaleItemSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true },
    category: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    // Items refunded (whether or not they went back into stock).
    returnedQuantity: { type: Number, default: 0, min: 0 },
    // Of those, the ones put back into stock.
    restockedQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SaleItemSchema.pre("validate", function () {
  this.subtotal = round2(this.sellingPrice * this.quantity);
  this.totalCost = round2(this.costPrice * this.quantity);
  this.profit = round2(this.subtotal - this.totalCost);
});

export default mongoose.models.SaleItem || mongoose.model("SaleItem", SaleItemSchema);
