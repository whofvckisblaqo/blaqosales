import { round2 } from "./money";
import { isValidId } from "./api";
import { PAYMENT_METHODS } from "@/models/Sale";

// Validates and cleans the sale form data. Returns { data } or { error }.
// Totals are NOT read from the client; the server recalculates them.
export function parseSaleInput(body) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return { error: "Add at least one product." };
  if (rawItems.length > 50) return { error: "Too many products in one sale." };

  const seen = new Set();
  const items = [];

  for (const raw of rawItems) {
    if (!isValidId(raw.productId)) return { error: "Choose a product for every row." };
    if (seen.has(String(raw.productId))) {
      return { error: "The same product appears twice. Increase its quantity instead." };
    }
    seen.add(String(raw.productId));

    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return { error: "Quantity must be a whole number of 1 or more." };

    const costPrice = Number(raw.costPrice);
    const sellingPrice = Number(raw.sellingPrice);
    if (!Number.isFinite(costPrice) || costPrice < 0) return { error: "Enter a valid cost price for every product." };
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) return { error: "Enter a valid selling price for every product." };

    items.push({
      productId: String(raw.productId),
      quantity,
      costPrice: round2(costPrice),
      sellingPrice: round2(sellingPrice),
    });
  }

  const money = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) && n >= 0 ? round2(n) : NaN;
  };

  const discount = money(body.discount);
  const deliveryFee = money(body.deliveryFee);
  const otherCharges = money(body.otherCharges);
  const amountPaid = money(body.amountPaid);
  const packagingCost = money(body.packagingCost);
  if ([discount, deliveryFee, otherCharges, amountPaid, packagingCost].some(Number.isNaN)) {
    return { error: "Discount, charges and amount paid must be 0 or more." };
  }

  const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : "cash";

  let date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();

  let dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) dueDate = null;

  return {
    data: {
      date,
      customerName: String(body.customerName || "").trim(),
      customerPhone: String(body.customerPhone || "").trim(),
      items,
      discount,
      deliveryFee,
      otherCharges,
      amountPaid,
      packagingCost,
      paymentMethod,
      dueDate,
      notes: String(body.notes || "").trim(),
    },
  };
}
