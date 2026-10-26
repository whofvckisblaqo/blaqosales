"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatNaira, round2 } from "@/lib/money";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/paymentMethods";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function RecordPaymentModal({ sale, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(sale.balance));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const value = Number(amount) || 0;
  const remaining = round2(sale.balance - value);
  const invalid = value <= 0 || remaining < 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (invalid) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${sale._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not record the payment.");
        setSaving(false);
        return;
      }
      onSaved(remaining <= 0 ? `${sale.orderNumber} is now fully paid.` : `Payment recorded. ${formatNaira(remaining)} still owed.`);
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-xl bg-gray-50 p-4 text-sm">
          <p className="font-medium text-gray-900">{sale.customerName}</p>
          <p className="text-xs text-gray-500">{sale.orderNumber}</p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Order total</span><span>{formatNaira(sale.total)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid so far</span><span>{formatNaira(sale.amountPaid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Owed</span><span className="text-red-600">{formatNaira(sale.balance)}</span></div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="pay-amount" className="text-sm font-medium text-gray-700">Amount received (₦)</label>
            <button type="button" onClick={() => setAmount(String(sale.balance))} className="text-xs font-medium text-brand-600 hover:text-brand-700">Pay in full</button>
          </div>
          <input id="pay-amount" type="number" min="0" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          <p className={`mt-1 text-xs ${remaining < 0 ? "text-red-600" : "text-gray-500"}`}>
            {remaining < 0 ? "That is more than what is owed." : value > 0 ? `Still owed after this: ${formatNaira(remaining)}` : " "}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pay-method" className="mb-1.5 block text-sm font-medium text-gray-700">Payment method</label>
            <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {PAYMENT_METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pay-ref" className="mb-1.5 block text-sm font-medium text-gray-700">Reference (optional)</label>
            <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} placeholder="e.g. transfer ref" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving || invalid} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record payment
          </button>
        </div>
      </form>
    </Modal>
  );
}
