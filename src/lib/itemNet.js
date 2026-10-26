import { round2 } from "./money";

// A sale item after discount and refunds.
//   The sale's discount is shared across items in proportion to what each item sold for.
//   Cost stays on the books for goods that were refunded but not put back in stock.
export function netItem(item, sale) {
  const share = sale.subtotal > 0 ? (sale.discount || 0) / sale.subtotal : 0;
  const returned = item.returnedQuantity || 0;
  const restocked = item.restockedQuantity || 0;
  const qty = item.quantity - returned;
  const revenue = round2(qty * item.sellingPrice * (1 - share));
  const cost = round2((item.quantity - restocked) * item.costPrice);
  return { qty, revenue, cost, profit: round2(revenue - cost) };
}
