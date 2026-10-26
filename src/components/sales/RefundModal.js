"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatNaira, round2, balanceOf } from "@/lib/money";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export default function RefundModal({ saleId, orderNumber, onClose, onDone }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState({}); // itemId -> string
  const [restock, setRestock] = useState({}); // itemId -> bool
  const [cash, setCash] = useState(null); // null = use the suggested amount
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/sales/${saleId}`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setError(d.error || "Could not load this sale.");
        setData(d);
        const q = {};
        const rs = {};
        for (const i of d.items) {
          q[i._id] = "0";
          rs[i._id] = true;
        }
        setQty(q);
        setRestock(rs);
      })
      .catch(() => setError("Could not load this sale."));
  }, [saleId]);

  const sale = data?.sale;
  const rows = useMemo(
    () => (data?.items || []).map((i) => ({ ...i, left: i.quantity - (i.returnedQuantity || 0) })),
    [data]
  );

  const calc = useMemo(() => {
    if (!sale) return null;
    const share = sale.subtotal > 0 ? sale.discount / sale.subtotal : 0;
    let revenue = 0;
    let cost = 0;
    let count = 0;
    let allBack = true;
    for (const r of rows) {
      const q = Math.max(0, Math.min(r.left, Math.floor(Number(qty[r._id]) || 0)));
      count += q;
      if (q !== r.left) allBack = false;
      revenue += q * r.sellingPrice * (1 - share);
      if (restock[r._id]) cost += q * r.costPrice;
    }
    revenue = round2(revenue);
    if (count > 0 && allBack) revenue = round2(sale.subtotal - sale.discount - (sale.refundedRevenue || 0));
    cost = round2(cost);

    const paidBack = sale.refundedAmount || 0;
    const maxCash = round2(sale.amountPaid - paidBack);
    const owedAfter = round2(sale.total - (sale.refundedRevenue || 0) - revenue);
    const suggested = round2(Math.min(maxCash, Math.max(0, maxCash - owedAfter)));
    return { revenue, cost, count, maxCash, suggested };
  }, [sale, rows, qty, restock]);

  if (error) {
    return (
      <Modal title={`Refund ${orderNumber}`} onClose={onClose}>
        <p className="text-sm text-red-600">{error}</p>
      </Modal>
    );
  }

  if (!sale) {
    return (
      <Modal title={`Refund ${orderNumber}`} onClose={onClose}>
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Modal>
    );
  }

  const cashValue = cash === null ? calc.suggested : Number(cash) || 0;
  const cashTooHigh = cashValue > calc.maxCash;
  const balanceAfter = balanceOf({
    total: sale.total,
    refundedRevenue: (sale.refundedRevenue || 0) + calc.revenue,
    amountPaid: sale.amountPaid,
    refundedAmount: (sale.refundedAmount || 0) + cashValue,
  });
  const nothingLeft = rows.every((r) => r.left === 0);

  function refundAll() {
    const q = {};
    for (const r of rows) q[r._id] = String(r.left);
    setQty(q);
    setCash(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (saving || calc.count === 0 || cashTooHigh) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${saleId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows
            .filter((r) => Number(qty[r._id]) > 0)
            .map((r) => ({ itemId: r._id, quantity: Number(qty[r._id]), restock: Boolean(restock[r._id]) })),
          cashRefund: cashValue,
          method,
          reason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not save the refund.");
        setSaving(false);
        return;
      }
      onDone?.(orderNumber);
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title={`Refund ${orderNumber}`} onClose={onClose} wide>
      {nothingLeft ? (
        <p className="text-sm text-gray-600">Everything on this sale has already been refunded.</p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Choose what the customer is returning.</p>
            <button type="button" onClick={refundAll} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Refund everything
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((r) =>
              r.left === 0 ? null : (
                <div key={r._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{r.productName}</p>
                      <p className="text-xs text-gray-500">
                        {formatNaira(r.sellingPrice)} each · {r.left} can be refunded
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={r.left}
                      step="1"
                      aria-label={`Quantity of ${r.productName} to refund`}
                      value={qty[r._id]}
                      onChange={(e) => {
                        setQty((q) => ({ ...q, [r._id]: e.target.value }));
                        setCash(null);
                      }}
                      className={`${inputClass} w-20 text-center`}
                    />
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={Boolean(restock[r._id])}
                      onChange={(e) => setRestock((s) => ({ ...s, [r._id]: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    Return to inventory (untick if damaged or not resellable)
                  </label>
                </div>
              )
            )}
          </div>

          <div className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4 py-2 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Value of goods refunded</span>
              <span className="font-medium text-gray-900">{formatNaira(calc.revenue)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Profit given back</span>
              <span className="font-medium text-gray-900">{formatNaira(calc.revenue - calc.cost)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Customer still owes after refund</span>
              <span className={`font-medium ${balanceAfter > 0 ? "text-red-600" : "text-gray-900"}`}>{formatNaira(balanceAfter)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cash" className="mb-1.5 block text-sm font-medium text-gray-700">Cash handed back (₦)</label>
              <input
                id="cash"
                type="number"
                min="0"
                step="any"
                value={cash === null ? String(calc.suggested) : cash}
                onChange={(e) => setCash(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">
                Set 0 to only reduce what they owe. Most you can give back: {formatNaira(calc.maxCash)}.
              </p>
            </div>
            <div>
              <label htmlFor="rmethod" className="mb-1.5 block text-sm font-medium text-gray-700">Refund method</label>
              <select id="rmethod" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-gray-700">Reason (optional)</label>
              <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
            </div>
          </div>

          {cashTooHigh && <p className="text-sm text-red-600">That is more than the customer has paid.</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || calc.count === 0 || cashTooHigh}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save refund
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
