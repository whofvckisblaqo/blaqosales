"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { allocateInboundCosts, blendedCost } from "@/lib/landedCost";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const COST_CATEGORIES = ["Transport", "Delivery", "Packaging", "Supplier", "Miscellaneous"];

let counter = 0;
const newItem = () => ({ key: ++counter, productId: "", quantity: "1", unitCost: "" });
const newCost = (category = "Transport") => ({ key: ++counter, category, amount: "", note: "" });

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

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

export default function ReceiveStockContent() {
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [date, setDate] = useState(nowLocal);
  const [items, setItems] = useState([newItem()]);
  const [costs, setCosts] = useState([newCost()]);
  const [method, setMethod] = useState("quantity");
  const [note, setNote] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [paidInFull, setPaidInFull] = useState(true);
  const [paidAmount, setPaidAmount] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  async function loadProducts() {
    setLoadError("");
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load products.");
      setProducts(data.products.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setLoadError(err.message || "Could not load products.");
      setProducts([]);
    }
  }

  useEffect(() => {
    loadProducts();
    fetch("/api/suppliers?all=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {});
  }, []);

  const productById = useMemo(() => new Map((products || []).map((p) => [p._id, p])), [products]);

  function updateItem(key, patch) {
    setItems((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function pickProduct(key, productId) {
    const p = productById.get(productId);
    updateItem(key, { productId, unitCost: p ? String(p.costPrice) : "" });
  }

  function updateCost(key, patch) {
    setCosts((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  // Live calculation. The server runs this same function when saving.
  const allocation = allocateInboundCosts({
    items: items.map((i) => ({ quantity: Number(i.quantity) || 0, unitCost: Number(i.unitCost) || 0 })),
    expenses: costs.map((c) => ({ amount: Number(c.amount) || 0 })),
    method,
  });

  const amountPaid = paidInFull ? allocation.goodsTotal : Number(paidAmount) || 0;
  const owedToSupplier = Math.max(allocation.goodsTotal - amountPaid, 0);
  const paidTooMuch = amountPaid > allocation.goodsTotal;

  const chosen = items.map((i) => i.productId).filter(Boolean);
  const hasDuplicate = new Set(chosen).size !== chosen.length;
  const incomplete = items.some((i) => !i.productId || !(Number(i.quantity) >= 1) || i.unitCost === "");
  const blocker = incomplete
    ? "Choose a product, quantity and cost for every row."
    : paidTooMuch
    ? "Amount paid cannot be more than the cost of the goods."
    : owedToSupplier > 0 && !supplierId
    ? "Choose the supplier you still owe, or mark the goods as paid in full."
    : hasDuplicate
    ? "The same product appears twice. Combine it into one row."
    : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (blocker || saving) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/stock-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          items: items.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
          })),
          expenses: costs.map((c) => ({ category: c.category, amount: Number(c.amount) || 0, note: c.note })),
          method,
          note,
          supplierId: supplierId || null,
          amountPaid,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not save the delivery.");
        setSaving(false);
        return;
      }
      setDone(data.receipt);
      setSaving(false);
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  function startAnother() {
    setDone(null);
    setDate(nowLocal());
    setItems([newItem()]);
    setCosts([newCost()]);
    setMethod("quantity");
    setNote("");
    setSupplierId("");
    setPaidInFull(true);
    setPaidAmount("");
    setError("");
    setProducts(null);
    loadProducts();
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Stock received</h1>
          <p className="mt-1 text-sm text-gray-500">{done.receiptNumber}</p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost each</th>
                <th className="px-4 py-2.5 text-right font-medium">New cost price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {done.items.map((i) => (
                <tr key={i.product}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{i.productName}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{i.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{formatNaira(i.landedUnitCost)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatNaira(i.newCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm">
          <div className="flex justify-between py-1"><span className="text-gray-500">Goods</span><span className="font-medium">{formatNaira(done.goodsTotal)}</span></div>
          <div className="flex justify-between py-1"><span className="text-gray-500">Transport and other costs</span><span className="font-medium">{formatNaira(done.expensesTotal)}</span></div>
          <div className="flex justify-between border-t border-gray-100 py-1.5"><span className="font-medium text-gray-900">Total</span><span className="font-semibold">{formatNaira(done.grandTotal)}</span></div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={startAnother} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            Receive another delivery
          </button>
          <Link href="/products" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Receive Stock</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter everything that arrived together, then the costs of bringing it in. The costs are shared across the goods automatically.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={loadProducts} className="font-medium underline">Try again</button>
        </div>
      )}

      {products && products.length === 0 && !loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have no products yet. <Link href="/products" className="font-medium underline">Add the products first</Link>, then receive stock.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date and time received" htmlFor="date">
                <input id="date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Supplier" htmlFor="supplier">
                <select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount paid for the goods" htmlFor="paid" hint={owedToSupplier > 0 ? `You will owe the supplier ${formatNaira(owedToSupplier)}.` : undefined}>
                <label className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={paidInFull} onChange={(e) => setPaidInFull(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                  Paid in full ({formatNaira(allocation.goodsTotal)})
                </label>
                {!paidInFull && (
                  <input id="paid" type="number" min="0" step="any" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={inputClass} placeholder="Amount paid so far (₦)" />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Note (optional)" htmlFor="note">
                  <input id="note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </div>
          </section>

          {/* Goods */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Goods that came in</h2>

            {products === null ? (
              <div className="h-24 animate-pulse rounded-xl bg-gray-200/70" />
            ) : (
              <div className="space-y-4">
                {items.map((r, idx) => {
                  const p = productById.get(r.productId);
                  return (
                    <div key={r.key} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Item {idx + 1}</span>
                        {items.length > 1 && (
                          <button type="button" aria-label="Remove item" onClick={() => setItems((rs) => rs.filter((x) => x.key !== r.key))} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Product" htmlFor={`p-${r.key}`} hint={p ? `Currently ${p.stock} in stock at ${formatNaira(p.costPrice)} each` : undefined}>
                            <select id={`p-${r.key}`} value={r.productId} onChange={(e) => pickProduct(r.key, e.target.value)} className={inputClass}>
                              <option value="">Select a product</option>
                              {products.map((prod) => (
                                <option key={prod._id} value={prod._id}>{prod.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label="Quantity received" htmlFor={`q-${r.key}`}>
                          <input id={`q-${r.key}`} type="number" min="1" step="1" value={r.quantity} onChange={(e) => updateItem(r.key, { quantity: e.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Supplier price each (₦)" htmlFor={`c-${r.key}`}>
                          <input id={`c-${r.key}`} type="number" min="0" step="any" value={r.unitCost} onChange={(e) => updateItem(r.key, { unitCost: e.target.value })} className={inputClass} />
                        </Field>
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={() => setItems((rs) => [...rs, newItem()])} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700">
                  <Plus className="h-4 w-4" />
                  Add another product
                </button>
              </div>
            )}
          </section>

          {/* Costs */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Costs of bringing them in</h2>
            <p className="mb-4 mt-1 text-xs text-gray-500">Transport, loading, anything you paid for this whole delivery. Leave the amount empty if there is none.</p>

            <div className="space-y-3">
              {costs.map((c) => (
                <div key={c.key} className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[160px_1fr_1fr_auto]">
                  <select aria-label="Cost type" value={c.category} onChange={(e) => updateCost(c.key, { category: e.target.value })} className={inputClass}>
                    {COST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input aria-label="Amount" type="number" min="0" step="any" placeholder="Amount (₦)" value={c.amount} onChange={(e) => updateCost(c.key, { amount: e.target.value })} className={`${inputClass} order-last col-span-2 sm:order-none sm:col-span-1`} />
                  <input aria-label="Note" placeholder="Note (optional)" value={c.note} onChange={(e) => updateCost(c.key, { note: e.target.value })} className={`${inputClass} order-last col-span-2 sm:order-none sm:col-span-1`} />
                  {costs.length > 1 ? (
                    <button type="button" aria-label="Remove cost" onClick={() => setCosts((cs) => cs.filter((x) => x.key !== c.key))} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setCosts((cs) => [...cs, newCost("Miscellaneous")])} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700">
              <Plus className="h-4 w-4" />
              Add another cost
            </button>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Share these costs across the goods</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "quantity", title: "By quantity", text: "Every item carries the same share." },
                  { value: "value", title: "By value", text: "Pricier items carry a bigger share." },
                ].map((o) => (
                  <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${method === o.value ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
                    <input type="radio" name="method" value={o.value} checked={method === o.value} onChange={() => setMethod(o.value)} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block font-medium text-gray-900">{o.title}</span>
                      <span className="text-xs text-gray-500">{o.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Live result */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-8">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">What each product really costs</h2>

            <div className="space-y-3">
              {items.map((r, idx) => {
                const p = productById.get(r.productId);
                const line = allocation.lines[idx];
                if (!p) return null;
                const newAverage = blendedCost({
                  stock: p.stock,
                  costPrice: p.costPrice,
                  quantity: line.quantity,
                  lineTotal: line.lineTotal,
                });
                return (
                  <div key={r.key} className="rounded-xl bg-gray-50 p-3 text-sm">
                    <p className="font-medium text-gray-900">{p.label}</p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                      <div className="flex justify-between"><span>Supplier price</span><span>{formatNaira(line.unitCost)}</span></div>
                      <div className="flex justify-between"><span>Share of costs (each)</span><span>{formatNaira(line.quantity > 0 ? line.share / line.quantity : 0)}</span></div>
                      <div className="flex justify-between font-medium text-gray-900"><span>Cost each</span><span>{formatNaira(line.landedUnitCost)}</span></div>
                      {p.stock > 0 && (
                        <div className="flex justify-between border-t border-gray-200 pt-1 text-gray-600">
                          <span>New cost price (with {p.stock} in stock)</span>
                          <span className="font-medium">{formatNaira(newAverage)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 divide-y divide-gray-100 text-sm">
              <div className="flex justify-between py-2"><span className="text-gray-500">Goods</span><span className="font-medium">{formatNaira(allocation.goodsTotal)}</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-500">Transport and other costs</span><span className="font-medium">{formatNaira(allocation.expensesTotal)}</span></div>
              <div className="flex justify-between py-2"><span className="font-medium text-gray-900">Total</span><span className="font-semibold">{formatNaira(allocation.grandTotal)}</span></div>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            {blocker && !error && <p className="mt-4 text-sm text-amber-700">{blocker}</p>}

            <button type="submit" disabled={saving || Boolean(blocker) || !products || products.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save delivery"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
