import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./Sale";

// One document for the whole app (there is only one business).
const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    businessName: { type: String, default: "Blaqo Scents", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    // Shown on receipts only. Tax is not added to sales automatically.
    taxName: { type: String, default: "", trim: true },
    taxNumber: { type: String, default: "", trim: true },
    invoiceFooter: { type: String, default: "", trim: true },
    thankYouMessage: { type: String, default: "Thank you for your patronage!", trim: true },
    defaultPaymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    defaultDiscount: { type: Number, default: 0, min: 0 },
    allowNegativeStock: { type: Boolean, default: false },
    autoStockDeduction: { type: Boolean, default: true },
    // Set once, when all your products are loaded and you start using the app for real.
    startedAt: { type: Date, default: null },
    startingStockValue: { type: Number, default: 0 },
    // Products at or below this many items are "low stock".
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    // Expenses at or above this amount show up as a notification.
    largeExpenseThreshold: { type: Number, default: 50000, min: 0 },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

export async function getSettings() {
  let doc = await Settings.findOne({ key: "main" });
  if (!doc) {
    try {
      doc = await Settings.create({ key: "main" });
    } catch {
      doc = await Settings.findOne({ key: "main" });
    }
  }
  return doc;
}

export default Settings;
