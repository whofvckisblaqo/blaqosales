"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Eye, HandCoins, Mail, MapPin, Pencil, Phone, Receipt } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import SaleDetailModal from "@/components/sales/SaleDetailModal";
import CustomerFormModal from "./CustomerFormModal";
import RecordPaymentModal from "./RecordPaymentModal";
import SaleStatusBadge from "./SaleStatusBadge";

function productSummary(items) {
  if (!items.length) return "—";
  return items.length > 1 ? `${items[0].productName} +${items.length - 1} more` : items[0].productName;
}

export default function CustomerProfileContent({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load this customer.");
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  const back = (
    <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" /> Customers
    </Link>
  );

  if (error && !data) {
    return (
      <div className="space-y-4">
        {back}
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {back}
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200/70" />
        <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200/70" />)}</div>
      </div>
    );
  }

  const { customer, sales } = data;

  return (
    <div className="space-y-6">
      {back}

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone}</p>}
            {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {customer.email}</p>}
            {customer.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {customer.address}</p>}
            {!customer.phone && !customer.email && !customer.address && <p>No contact details yet.</p>}
          </div>
        </div>
        <button type="button" onClick={() => setModal({ type: "edit" })} className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Pencil className="h-4 w-4" /> Edit
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Number of orders", customer.orders, ""],
          ["Total spent", formatNaira(customer.spent), ""],
          ["Outstanding balance", formatNaira(customer.balance), customer.balance > 0 ? "text-red-600" : ""],
          ["Last purchase", customer.lastPurchase ? formatDate(customer.lastPurchase) : "—", ""],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone || "text-gray-900"}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Purchase history</h2>
        </div>

        {sales.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Receipt className="h-5 w-5" /></div>
            <p className="text-sm font-medium text-gray-900">No purchases yet</p>
            <p className="mt-1 text-sm text-gray-500">Sales recorded for this customer will show here.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order ID</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Products</th>
                    <th className="px-3 py-3 text-right font-medium">Total</th>
                    <th className="px-3 py-3 text-right font-medium">Paid</th>
                    <th className="px-3 py-3 text-right font-medium">Balance</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50/60">
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">{s.orderNumber}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600">{formatDate(s.date)}</td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-gray-700">{productSummary(s.items)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900">{formatNaira(s.total)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-gray-600">{formatNaira(s.amountPaid)}</td>
                      <td className={`whitespace-nowrap px-3 py-3 text-right font-medium ${s.balance > 0 ? "text-red-600" : "text-gray-400"}`}>{s.balance > 0 ? formatNaira(s.balance) : "—"}</td>
                      <td className="px-3 py-3"><SaleStatusBadge sale={s} /></td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" title="View sale" aria-label="View sale" onClick={() => setModal({ type: "view", sale: s })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Eye className="h-4 w-4" /></button>
                          {s.balance > 0 && (
                            <button type="button" onClick={() => setModal({ type: "pay", sale: s })} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"><HandCoins className="h-3.5 w-3.5" /> Record payment</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {sales.map((s) => (
                <div key={s._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{s.orderNumber}</p>
                      <p className="truncate text-xs text-gray-500">{formatDate(s.date)} · {productSummary(s.items)}</p>
                    </div>
                    <SaleStatusBadge sale={s} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-900">{formatNaira(s.total)}</span>
                    {s.balance > 0 && <span className="font-medium text-red-600">Owes {formatNaira(s.balance)}</span>}
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setModal({ type: "view", sale: s })} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">View</button>
                    {s.balance > 0 && (
                      <button type="button" onClick={() => setModal({ type: "pay", sale: s })} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"><HandCoins className="h-4 w-4" /> Record payment</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <AnimatePresence>
        {modal?.type === "edit" && (
          <CustomerFormModal key="edit" customer={customer} onClose={() => setModal(null)} onSaved={() => { setModal(null); flash("Customer updated."); load(); }} />
        )}
        {modal?.type === "pay" && (
          <RecordPaymentModal key="pay" sale={modal.sale} onClose={() => setModal(null)} onSaved={(msg) => { setModal(null); flash(msg); load(); }} />
        )}
        {modal?.type === "view" && (
          <SaleDetailModal key="view" saleId={modal.sale._id} orderNumber={modal.sale.orderNumber} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
