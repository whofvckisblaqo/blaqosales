"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function CustomerFormModal({ customer, onClose, onSaved }) {
  const isEdit = Boolean(customer);
  const [form, setForm] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/customers/${customer._id}` : "/api/customers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the customer.");
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
    <Modal title={isEdit ? "Edit customer" : "Add customer"} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <Field label="Name" htmlFor="c-name">
          <input id="c-name" required value={form.name} onChange={set("name")} className={inputClass} />
        </Field>
        <Field label="Phone number" htmlFor="c-phone">
          <input id="c-phone" type="tel" value={form.phone} onChange={set("phone")} className={inputClass} />
        </Field>
        <Field label="Email (optional)" htmlFor="c-email">
          <input id="c-email" type="email" value={form.email} onChange={set("email")} className={inputClass} />
        </Field>
        <Field label="Address (optional)" htmlFor="c-address">
          <textarea id="c-address" rows={2} value={form.address} onChange={set("address")} className={inputClass} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
