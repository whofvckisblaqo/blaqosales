"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatNaira, round2 } from "@/lib/money";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/paymentMethods";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function PaySupplierModal({ supplier, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(supplier.owing));
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const value = Number(amount) || 0;
  const remaining = round2(supplier.owing - value);
  const invalid = value <= 0 || remaining < 0;

  async function submit(e) {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not record the payment.");
        setSaving(false);
        return;
      }
      onSaved(remaining <= 0 ? `${supplier.name} is fully paid.` : `Payment recorded. You still owe ${formatNaira(remaining)}.`);
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title={`Pay ${supplier.name}`} onClose={saving ? () => {} : onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">You owe {formatNaira(supplier.owing)}.</p>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div>
          <label htmlFor="sp-amount" className="mb-1.5 block text-sm font-medium text-gray-700">Amount (₦)</label>
          <input id="sp-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          {remaining < 0 && <p className="mt-1 text-xs text-red-600">That is more than you owe.</p>}
        </div>
        <div>
          <label htmlFor="sp-method" className="mb-1.5 block text-sm font-medium text-gray-700">Payment method</label>
          <select id="sp-method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {PAYMENT_METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sp-note" className="mb-1.5 block text-sm font-medium text-gray-700">Note (optional)</label>
          <input id="sp-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving || invalid} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record payment
          </button>
        </div>
      </form>
    </Modal>
  );
}
