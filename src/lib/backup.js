import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Supplier from "@/models/Supplier";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import StockMovement from "@/models/StockMovement";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import StockReceipt from "@/models/StockReceipt";
import Refund from "@/models/Refund";
import SupplierPayment from "@/models/SupplierPayment";
import CashEntry from "@/models/CashEntry";
import DayClosing from "@/models/DayClosing";
import Settings from "@/models/Settings";
import Counter from "@/models/Counter";

// Everything except user accounts (so a restore can never lock you out).
export const BACKUP_MODELS = {
  products: Product,
  customers: Customer,
  suppliers: Supplier,
  sales: Sale,
  saleItems: SaleItem,
  stockMovements: StockMovement,
  payments: Payment,
  expenses: Expense,
  stockReceipts: StockReceipt,
  refunds: Refund,
  supplierPayments: SupplierPayment,
  cashEntries: CashEntry,
  dayClosings: DayClosing,
  settings: Settings,
  counters: Counter,
};

export async function createBackup() {
  const collections = {};
  for (const [key, Model] of Object.entries(BACKUP_MODELS)) {
    collections[key] = JSON.parse(JSON.stringify(await Model.find().lean()));
  }
  return { app: "blaqosales-tracker", version: 1, createdAt: new Date().toISOString(), collections };
}

// Checks a backup file before anything is touched. Returns an error message or null.
export function validateBackup(file) {
  if (!file || file.app !== "blaqosales-tracker" || typeof file.collections !== "object") {
    return "That is not a Blaqo backup file.";
  }
  for (const [key, Model] of Object.entries(BACKUP_MODELS)) {
    const docs = file.collections[key];
    if (docs === undefined) continue;
    if (!Array.isArray(docs)) return `The backup file is damaged (${key}).`;
    for (const doc of docs) {
      const err = new Model(doc).validateSync();
      if (err) return `The backup file is damaged (${key}): ${err.message}`;
    }
  }
  return null;
}

// Replaces all business data with the backup. If anything fails part-way, the old data is put back.
export async function restoreBackup(file) {
  const old = await createBackup();
  try {
    for (const [key, Model] of Object.entries(BACKUP_MODELS)) {
      const docs = file.collections[key];
      if (docs === undefined) continue;
      await Model.deleteMany({});
      if (docs.length) await Model.insertMany(docs, { ordered: true });
    }
  } catch (err) {
    for (const [key, Model] of Object.entries(BACKUP_MODELS)) {
      await Model.deleteMany({});
      const docs = old.collections[key];
      if (docs?.length) await Model.insertMany(docs, { ordered: true });
    }
    throw err;
  }
}
