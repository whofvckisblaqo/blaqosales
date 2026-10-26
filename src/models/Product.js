import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true },
    category: { type: String, default: "Perfume", trim: true },
    // Bottle size in ml. 0 means no size (non-perfume products).
    size: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true, unique: true, sparse: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    // Current prices. Past sales keep their own snapshot in SaleItem.
    costPrice: { type: Number, required: true, min: 0 },
    // Not used by the app: the selling price is entered on each sale.
    sellingPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.virtual("potentialProfit").get(function () {
  return (this.sellingPrice - this.costPrice) * Math.max(this.stock, 0);
});

ProductSchema.virtual("stockStatus").get(function () {
  if (this.stock <= 0) return "out_of_stock";
  if (this.stock <= this.lowStockThreshold) return "low_stock";
  return "in_stock";
});

// Name with the size, e.g. "Club de Nuit Intense Man 105ml". Used in lists and sales.
ProductSchema.virtual("label").get(function () {
  return this.size > 0 ? `${this.name} ${this.size}ml` : this.name;
});

ProductSchema.set("toJSON", { virtuals: true });
ProductSchema.set("toObject", { virtuals: true });
ProductSchema.index({ name: "text", brand: "text", sku: "text" });

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
