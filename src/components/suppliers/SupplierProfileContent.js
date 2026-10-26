"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, HandCoins, Pencil, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SupplierFormModal from "./SupplierFormModal";
import PaySupplierModal from "./PaySupplierModal";

const METHOD_LABELS = { cash: "Cash", transfer: "Bank Transfer", pos: "POS", card: "Card", other: "Other" };

export default function SupplierProfileContent({ supplierId }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // edit | pay | delete
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load this supplier.");
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [supplierId]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not delete the supplier.");
      router.push("/suppliers");
    } catch (err) {
      setBusy(false);
      setModal(null);
      setError(err.message);
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Suppliers</Link>
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>
      </div>
    );
  }
  if (!data) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />)}</div>;

  const { supplier: s, receipts, payments, products } = data;

  return (
    <div className="space-y-6">
      <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Suppliers</Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{s.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{[s.phone, s.email, s.address].filter(Boolean).join(" · ") || "No contact details"}</p>
          {s.notes && <p className="mt-1 text-sm text-gray-500">{s.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {s.owing > 0 && (
            <button type="button" onClick={() => setModal("pay")} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"><HandCoins className="h-4 w-4" /> Pay supplier</button>
          )}
          <button type="button" onClick={() => setModal("edit")} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Pencil className="h-4 w-4" /> Edit</button>
          <button type="button" onClick={() => setModal("delete")} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Deliveries", s.deliveries],
          ["Total purchased", formatNaira(s.purchased)],
          ["Total paid", formatNaira(s.paid)],
          ["You owe", formatNaira(s.owing), s.owing > 0],
        ].map(([label, value, danger]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`mt-0.5 text-lg font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-900">Purchases</h2>
        {receipts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No deliveries from this supplier yet. Pick them on the Receive Stock page.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {receipts.map((r) => (
              <li key={r._id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-900">{r.receiptNumber} <span className="font-normal text-gray-500">· {formatDate(r.date)}</span></span>
                  <span className="font-medium text-gray-900">{formatNaira(r.goodsTotal)}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {r.items.map((i) => `${i.quantity} × ${i.productName}`).join(", ")} · paid {formatNaira(r.amountPaid)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {payments.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-900">Payments to this supplier</h2>
          <ul className="divide-y divide-gray-100">
            {payments.map((p) => (
              <li key={p._id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-gray-500">{formatDate(p.date)} · {METHOD_LABELS[p.method] || p.method}{p.note ? ` · ${p.note}` : ""}</span>
                <span className="font-medium text-gray-900">{formatNaira(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Products supplied</h2>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <span key={p._id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{p.name}</span>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {modal === "edit" && (
          <SupplierFormModal key="edit" supplier={s} onClose={() => setModal(null)} onSaved={() => { setModal(null); flash("Supplier updated."); load(); }} />
        )}
        {modal === "pay" && (
          <PaySupplierModal key="pay" supplier={s} onClose={() => setModal(null)} onSaved={(m) => { setModal(null); flash(m); load(); }} />
        )}
        {modal === "delete" && (
          <ConfirmDialog key="delete" title="Delete this supplier?" message="Their past deliveries stay in your records. This cannot be undone." confirmLabel="Delete supplier" danger loading={busy} onConfirm={remove} onCancel={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
