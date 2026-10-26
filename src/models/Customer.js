import mongoose from "mongoose";

// Totals (orders, amount spent, outstanding balance, last purchase) are NOT
// stored here. They are always computed from Sale records so they can never
// go out of sync.
const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", phone: "text" });
CustomerSchema.index({ phone: 1 });

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
