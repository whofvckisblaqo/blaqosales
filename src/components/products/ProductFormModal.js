"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { PERFUME_SIZES } from "@/lib/perfumeSizes";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    name: product?.name || "",
    brand: product?.brand || "",
    category: product?.category || "Perfume",
    sku: product?.sku || "",
    costPrice: product?.costPrice ?? "",
    stock: product?.stock ?? 0,
    image: product?.image || "",
    description: product?.description || "",
    supplier: product?.supplier || "",
    extraCost: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    fetch("/api/suppliers?all=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {});
  }, []);
  const initialSize = Number(product?.size) || 0;
  const [sizeChoice, setSizeChoice] = useState(
    initialSize ? (PERFUME_SIZES.includes(initialSize) ? String(initialSize) : "other") : ""
  );
  const [customSize, setCustomSize] = useState(
    initialSize && !PERFUME_SIZES.includes(initialSize) ? String(initialSize) : ""
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (sizeChoice === "other" && !(Number(customSize) > 0)) {
      setError("Enter the size in ml, or choose a size from the list.");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch(isEdit ? `/api/products/${product._id}` : "/api/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          size: sizeChoice === "other" ? Number(customSize) || 0 : Number(sizeChoice) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not save the product.");
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
    <Modal title={isEdit ? "Edit product" : "Add product"} onClose={saving ? () => {} : onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Product name" htmlFor="name">
              <input id="name" required value={form.name} onChange={set("name")} className={inputClass} placeholder="e.g. Club de Nuit Intense Man" />
            </Field>
          </div>
          <Field label="Brand" htmlFor="brand">
            <input id="brand" value={form.brand} onChange={set("brand")} className={inputClass} />
          </Field>
          <Field label="Category" htmlFor="category">
            <input id="category" value={form.category} onChange={set("category")} className={inputClass} />
          </Field>
          <Field label="Size (ml)" htmlFor="sizeChoice" hint="For perfumes. Choose 'No size' for other products.">
            <select id="sizeChoice" value={sizeChoice} onChange={(e) => setSizeChoice(e.target.value)} className={inputClass}>
              <option value="">No size</option>
              {PERFUME_SIZES.map((n) => (
                <option key={n} value={String(n)}>{n} ml</option>
              ))}
              <option value="other">Other size...</option>
            </select>
            {sizeChoice === "other" && (
              <input
                type="number"
                min="1"
                step="1"
                aria-label="Custom size in ml"
                placeholder="Size in ml"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                className={`${inputClass} mt-2`}
              />
            )}
          </Field>
          <Field label="Cost price (₦)" htmlFor="costPrice" hint="You enter the selling price each time you record a sale.">
            <input id="costPrice" type="number" min="0" step="any" required value={form.costPrice} onChange={set("costPrice")} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <Field label="Opening stock" htmlFor="stock">
              <input id="stock" type="number" min="0" step="1" value={form.stock} onChange={set("stock")} className={inputClass} />
            </Field>
          )}
          {!isEdit && (
            <Field
              label="Transport / other costs (optional)"
              htmlFor="extraCost"
              hint={
                Number(form.extraCost) > 0 && Number(form.stock) > 0
                  ? `Shared across ${form.stock} items. Cost each becomes about ₦${(((Number(form.costPrice) || 0) + Number(form.extraCost) / Number(form.stock)) || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}.`
                  : "Total you paid to bring this stock in. It is added to the cost price."
              }
            >
              <input id="extraCost" type="number" min="0" step="any" value={form.extraCost} onChange={set("extraCost")} className={inputClass} />
            </Field>
          )}
          <Field label="Supplier (optional)" htmlFor="supplier">
            <select id="supplier" value={form.supplier} onChange={set("supplier")} className={inputClass}>
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="SKU / product code" htmlFor="sku">
            <input id="sku" value={form.sku} onChange={set("sku")} className={inputClass} />
          </Field>
          <Field label="Image link (optional)" htmlFor="image">
            <input id="image" type="url" value={form.image} onChange={set("image")} className={inputClass} placeholder="https://..." />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="description">
              <textarea id="description" rows={3} value={form.description} onChange={set("description")} className={inputClass} />
            </Field>
          </div>
        </div>

        {isEdit && (
          <p className="text-xs text-gray-400">
            Changing the cost price only affects future sales. Past sales keep the cost they were recorded with.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
