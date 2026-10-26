import { round2 } from "./money";
import { isValidId } from "./api";

// Validates and cleans product form data. Returns { data } or { error }.
export function parseProductInput(body, { isCreate = false } = {}) {
  const name = String(body.name || "").trim();
  if (!name) return { error: "Product name is required." };

  const costPrice = round2(body.costPrice);
  if (!(Number(body.costPrice) >= 0)) return { error: "Enter a valid cost price." };

  const size = Math.max(0, Math.round(Number(body.size) || 0));
  const lowStockThreshold = Math.max(0, Math.floor(Number(body.lowStockThreshold ?? 3)) || 0);

  const data = {
    name,
    brand: String(body.brand || "").trim(),
    category: String(body.category || "").trim() || "Perfume",
    sku: String(body.sku || "").trim(),
    description: String(body.description || "").trim(),
    image: String(body.image || "").trim(),
    size,
    costPrice,
    lowStockThreshold,
    supplier: isValidId(body.supplier) ? String(body.supplier) : null,
  };

  if (isCreate) {
    const stock = Math.floor(Number(body.stock ?? 0));
    if (!Number.isFinite(stock) || stock < 0) return { error: "Stock must be 0 or more." };
    data.stock = stock;
  }

  return { data };
}
