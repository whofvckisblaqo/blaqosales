"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function StockModal({ product, onClose, onSaved }) {
  const [action, setAction] = useState("increase");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const qty = Math.floor(Number(quantity)) || 0;
  const newStock = action === "increase" ? product.stock + qty : product.stock - qty;
  const invalid = qty < 1 || newStock < 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (invalid) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/products/${product._id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, quantity: qty, reason }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not update stock.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title={`Adjust stock: ${product.label}`} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
          {[
            { value: "increase", label: "Add stock" },
            { value: "reduce", label: "Reduce stock" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAction(opt.value)}
              className={`rounded-md py-2 text-sm font-medium transition ${
                action === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="qty" className="mb-1.5 block text-sm font-medium text-gray-700">Quantity</label>
          <input id="qty" type="number" min="1" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-gray-700">Reason (optional)</label>
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder={action === "increase" ? "e.g. New delivery from supplier" : "e.g. Damaged bottle"} />
        </div>

        <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Stock: <span className="font-semibold text-gray-900">{product.stock}</span> →{" "}
          <span className={`font-semibold ${newStock < 0 ? "text-red-600" : "text-gray-900"}`}>
            {qty > 0 ? newStock : product.stock}
          </span>
          {newStock < 0 && <span className="ml-2 text-red-600">You only have {product.stock} in stock.</span>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={saving || invalid} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update stock
          </button>
        </div>
      </form>
    </Modal>
  );
}
