import mongoose from "mongoose";

// A saved snapshot of one day's figures, created by "Close Day".
const DayClosingSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true }, // "2026-09-01"
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    countedCash: { type: Number, default: null },
    note: { type: String, default: "" },
    closedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.DayClosing || mongoose.model("DayClosing", DayClosingSchema);
