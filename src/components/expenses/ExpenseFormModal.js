"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { dateInputValue, todayStr } from "@/lib/dates";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export const EXPENSE_CATEGORIES = [
  "Delivery",
  "Transport",
  "Rent",
  "Electricity",
  "Internet",
  "Advertising",
  "Packaging",
  "Staff",
  "Supplier",
  "Miscellaneous",
];

export const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ExpenseFormModal({ expense, onClose, onSaved }) {
  const isEdit = Boolean(expense);

  const [form, setForm] = useState({
    name: expense?.name || "",
    category: expense?.category || "Miscellaneous",
    amount: expense?.amount ?? "",
    date: expense ? dateInputValue(expense.date) : todayStr(),
    paymentMethod: expense?.paymentMethod || "cash",
    description: expense?.description || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(isEdit ? `/api/expenses/${expense._id}` : "/api/expenses", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not save the expense.");
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
    <Modal title={isEdit ? "Edit expense" : "Add expense"} onClose={saving ? () => {} : onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="What was it for?" htmlFor="name">
              <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="e.g. Shop rent for November" />
            </Field>
          </div>
          <Field label="Category" htmlFor="category">
            <select id="category" value={form.category} onChange={set("category")} className={inputClass}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₦)" htmlFor="amount">
            <input id="amount" type="number" min="0" step="any" required value={form.amount} onChange={set("amount")} className={inputClass} />
          </Field>
          <Field label="Date" htmlFor="date">
            <input id="date" type="date" required value={form.date} onChange={set("date")} className={inputClass} />
          </Field>
          <Field label="Payment method" htmlFor="paymentMethod">
            <select id="paymentMethod" value={form.paymentMethod} onChange={set("paymentMethod")} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)" htmlFor="description">
              <textarea id="description" rows={2} value={form.description} onChange={set("description")} className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
