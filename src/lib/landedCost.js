import { round2 } from "./money";

// Shares the costs of bringing goods in (transport etc.) across the goods that
// arrived. Used by the Receive Stock page preview AND the server, so the numbers
// you see are the numbers that get saved.
//
// method "quantity": every unit carries the same share.
// method "value":    shares follow the supplier cost of each line.
export function allocateInboundCosts({ items, expenses, method = "quantity" }) {
  const expensesTotal = round2(expenses.reduce((n, e) => n + (Number(e.amount) || 0), 0));

  const lines = items.map((i) => ({
    quantity: Number(i.quantity) || 0,
    unitCost: Number(i.unitCost) || 0,
  }));

  let weights = lines.map((l) => (method === "value" ? l.quantity * l.unitCost : l.quantity));
  let totalWeight = weights.reduce((n, w) => n + w, 0);
  if (totalWeight <= 0) {
    weights = lines.map((l) => l.quantity);
    totalWeight = weights.reduce((n, w) => n + w, 0);
  }

  let allocated = 0;
  const result = lines.map((l, idx) => {
    let share;
    if (idx === lines.length - 1) {
      // The last line takes the remainder so the shares add up exactly.
      share = round2(expensesTotal - allocated);
    } else {
      share = totalWeight > 0 ? round2((expensesTotal * weights[idx]) / totalWeight) : 0;
    }
    allocated = round2(allocated + share);

    const goodsCost = round2(l.quantity * l.unitCost);
    const lineTotal = round2(goodsCost + share);
    const landedUnitCost = l.quantity > 0 ? round2(lineTotal / l.quantity) : 0;

    return { ...l, goodsCost, share, lineTotal, landedUnitCost };
  });

  const goodsTotal = round2(result.reduce((n, l) => n + l.goodsCost, 0));
  return { lines: result, goodsTotal, expensesTotal, grandTotal: round2(goodsTotal + expensesTotal) };
}

// New cost price of a product after new goods join the stock already on the shelf
// (weighted average, so older stock keeps its older cost).
export function blendedCost({ stock, costPrice, quantity, lineTotal }) {
  const existing = Math.max(Number(stock) || 0, 0);
  const value = existing * (Number(costPrice) || 0) + lineTotal;
  const units = existing + quantity;
  return units > 0 ? round2(value / units) : 0;
}
