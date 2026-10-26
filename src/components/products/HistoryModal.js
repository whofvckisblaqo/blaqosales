"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

const TYPE_LABELS = {
  initial: "Opening stock",
  restock: "Stock added",
  sale: "Sale",
  sale_edit: "Sale edited",
  sale_delete: "Sale deleted",
  refund_return: "Refund returned",
  adjustment_in: "Adjustment (in)",
  adjustment_out: "Stock reduced",
};

export default function HistoryModal({ product, onClose }) {
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${product._id}/movements`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok) setError(d.error || "Could not load history.");
        else setMovements(d.movements);
      })
      .catch(() => !cancelled && setError("Could not load history."));
    return () => {
      cancelled = true;
    };
  }, [product._id]);

  return (
    <Modal title={`Stock history: ${product.label}`} onClose={onClose} wide>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && movements === null && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {movements && movements.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No stock changes recorded yet.</p>
      )}

      {movements && movements.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {movements.map((m) => (
            <li key={m._id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{TYPE_LABELS[m.type] || m.type}</p>
                <p className="truncate text-xs text-gray-500">{m.reason || "—"}</p>
                <p className="text-xs text-gray-400">
                  {new Date(m.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${m.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </p>
                <p className="text-xs text-gray-400">
                  {m.previousStock} → {m.newStock}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
