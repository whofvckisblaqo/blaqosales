// All money is stored as plain Naira numbers rounded to 2 decimals.
// Always round through this helper so totals never drift (e.g. 0.1 + 0.2).
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

// Pure calculation used by the sale model AND the live form preview,
// so the number on screen is always the number that gets saved.
export function calculateSaleTotals({
  items = [],
  discount = 0,
  deliveryFee = 0,
  otherCharges = 0,
  amountPaid = 0,
}) {
  let subtotal = 0;
  let totalCost = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    subtotal += (Number(item.sellingPrice) || 0) * qty;
    totalCost += (Number(item.costPrice) || 0) * qty;
  }

  subtotal = round2(subtotal);
  totalCost = round2(totalCost);
  discount = round2(discount);
  deliveryFee = round2(deliveryFee);
  otherCharges = round2(otherCharges);

  // Revenue = what the goods were sold for after discount.
  const revenue = round2(subtotal - discount);
  // Gross profit = revenue - cost of goods sold (delivery/other charges are pass-through, not profit).
  const profit = round2(revenue - totalCost);
  // Total = what the customer owes for this order.
  const total = round2(revenue + deliveryFee + otherCharges);
  const paid = round2(amountPaid);
  const balance = round2(Math.max(total - paid, 0));

  let paymentStatus = "unpaid";
  if (total > 0 && paid >= total) paymentStatus = "paid";
  else if (paid > 0) paymentStatus = "partial";
  if (total === 0) paymentStatus = "paid";

  return { subtotal, discount, revenue, totalCost, profit, deliveryFee, otherCharges, total, amountPaid: paid, balance, paymentStatus };
}

// What a customer still owes on a sale, after any refunds.
// refundedRevenue reduces the bill; refundedAmount is cash handed back (it reduces what they have paid).
export function balanceOf({ total = 0, refundedRevenue = 0, amountPaid = 0, refundedAmount = 0 }) {
  return round2(Math.max(total - refundedRevenue - (amountPaid - refundedAmount), 0));
}

// Plain-text amount for PDFs (the standard PDF fonts cannot print the naira sign).
export function formatNGN(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}NGN ${Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
