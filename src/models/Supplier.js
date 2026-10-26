import mongoose from "mongoose";

const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    amountPurchased: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SupplierSchema.virtual("outstandingBalance").get(function () {
  return Math.max(this.amountPurchased - this.amountPaid, 0);
});

SupplierSchema.set("toJSON", { virtuals: true });
SupplierSchema.set("toObject", { virtuals: true });
SupplierSchema.index({ name: "text" });

export default mongoose.models.Supplier || mongoose.model("Supplier", SupplierSchema);
