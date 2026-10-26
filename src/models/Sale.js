import mongoose from "mongoose";

export const PAYMENT_METHODS = ["cash", "transfer", "pos", "card", "other"];
export const PAYMENT_STATUSES = ["paid", "partial", "unpaid"];
export const SALE_STATUSES = ["completed", "partially_refunded", "refunded"];

// Totals here are filled in by the sale service using calculateSaleTotals()
// from "@/lib/money" - the same function the live form uses.
const SaleSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    // Full date AND time of the sale (used for daily/weekly/monthly reports).
    date: { type: Date, required: true, default: Date.now, index: true },

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, default: "Walk-in customer", trim: true },
    customerPhone: { type: String, default: "", trim: true },

    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    // What the bag/packaging cost YOU for this sale (not charged to the customer).
    // Saved as a Packaging expense linked to this sale.
    packagingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },

    totalCost: { type: Number, required: true, min: 0 },
    // Gross profit = (subtotal - discount) - totalCost
    profit: { type: Number, required: true },

    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, default: null },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid", index: true },

    status: { type: String, enum: SALE_STATUSES, default: "completed" },
    // Cash actually handed back to the customer through refunds.
    refundedAmount: { type: Number, default: 0, min: 0 },
    // Value of goods refunded (after the sale's share of discount).
    refundedRevenue: { type: Number, default: 0, min: 0 },
    // Cost of refunded goods that went back into stock.
    refundedCost: { type: Number, default: 0, min: 0 },
    // Profit given back through refunds, kept so the original sale history stays intact.
    refundedProfit: { type: Number, default: 0 },
    editedAt: { type: Date, default: null },

    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

SaleSchema.virtual("isOverdue").get(function () {
  return this.balance > 0 && this.dueDate && this.dueDate < new Date();
});

SaleSchema.set("toJSON", { virtuals: true });
SaleSchema.set("toObject", { virtuals: true });
SaleSchema.index({ customerName: "text", orderNumber: "text" });

export default mongoose.models.Sale || mongoose.model("Sale", SaleSchema);
