import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import Refund from "@/models/Refund";
import { getSettings } from "@/models/Settings";
import { isValidId } from "./api";

// Everything a receipt needs, in one place (used by the page and the PDF).
export async function loadReceipt(id) {
  if (!isValidId(id)) return null;
  const sale = await Sale.findById(id);
  if (!sale) return null;
  const [items, refunds, settings] = await Promise.all([
    SaleItem.find({ sale: id }),
    Refund.find({ sale: id }).sort({ date: 1 }),
    getSettings(),
  ]);
  return {
    sale: sale.toJSON(),
    items: items.map((i) => i.toJSON()),
    refunds: refunds.map((r) => r.toJSON()),
    settings: settings.toJSON(),
  };
}
