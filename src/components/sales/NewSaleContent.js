"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { dateInputValue } from "@/lib/dates";
import { calculateSaleTotals, formatNaira } from "@/lib/money";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const PAYMENT_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially Paid" },
  { value: "unpaid", label: "Unpaid" },
];

let rowCounter = 0;
const newRow = () => ({ key: ++rowCounter, productId: "", quantity: "1", costPrice: "", sellingPrice: "" });

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

function SummaryRow({ label, value, strong, tone }) {
  const toneClass = tone === "profit" ? "text-green-700" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={strong ? "font-medium text-gray-900" : "text-gray-500"}>{label}</span>
      <span className={`${strong ? "text-base font-semibold" : "font-medium"} ${toneClass}`}>{value}</span>
    </div>
  );
}

// Date and time as shown in a datetime-local box, in Nigerian time.
function localInputValue(value) {
  return new Date(new Date(value).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
}

export default function NewSaleContent({ saleId = null }) {
  const editing = Boolean(saleId);
  const [original, setOriginal] = useState(null); // the sale being edited
  const [lockedReason, setLockedReason] = useState("");
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [date, setDate] = useState(nowLocal);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [rows, setRows] = useState([newRow()]);
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [packagingCost, setPackagingCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [partialAmount, setPartialAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(null);

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
    if (editing) {
      (async () => {
        try {
          const res = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Could not load the sale.");
          const { sale, items } = data;
          if ((sale.refundedRevenue || 0) > 0 || sale.status !== "completed") {
            setLockedReason("This sale has refunds, so it can no longer be edited.");
          }
          setOriginal({ sale, items });
          setDate(localInputValue(sale.date));
          setCustomerName(sale.customerName === "Walk-in customer" ? "" : sale.customerName);
          setCustomerPhone(sale.customerPhone || "");
          setRows(
            items.map((it) => ({
              key: ++rowCounter,
              productId: it.product,
              quantity: String(it.quantity),
              costPrice: String(it.costPrice),
              sellingPrice: String(it.sellingPrice),
            }))
          );
          setDiscount(sale.discount ? String(sale.discount) : "");
          setDeliveryFee(sale.deliveryFee ? String(sale.deliveryFee) : "");
          setOtherCharges(sale.otherCharges ? String(sale.otherCharges) : "");
          setPackagingCost(sale.packagingCost ? String(sale.packagingCost) : "");
          setPaymentMethod(sale.paymentMethod);
          setDueDate(sale.dueDate ? dateInputValue(sale.dueDate) : "");
          setNotes(sale.notes || "");
        } catch (err) {
          setLoadError(err.message || "Could not load the sale.");
        }
      })();
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.settings) {
          setPaymentMethod(data.settings.defaultPaymentMethod || "cash");
          if (data.settings.defaultDiscount > 0) setDiscount(String(data.settings.defaultDiscount));
        }
      } catch {}
    })();
    // Bags usually cost the same each time, so remember the last amount used.
    try {
      const saved = window.localStorage.getItem("blaqo.baggingCost");
      if (saved) setPackagingCost(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(() => new Map((products || []).map((p) => [p._id, p])), [products]);

  // When editing, the items already on the sale are available to the sale again.
  const originalQty = useMemo(() => {
    const m = new Map();
    for (const it of original?.items || []) m.set(String(it.product), it.quantity);
    return m;
  }, [original]);
  const availableOf = (p) => (p ? p.stock + (originalQty.get(p._id) || 0) : 0);

  function updateRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function pickProduct(key, productId) {
    const p = productById.get(productId);
    updateRow(key, {
      productId,
      costPrice: p ? String(p.costPrice) : "",
    });
  }

  // Live calculation. The server runs this same function when saving.
  const items = rows.map((r) => ({
    quantity: Number(r.quantity) || 0,
    costPrice: Number(r.costPrice) || 0,
    sellingPrice: Number(r.sellingPrice) || 0,
  }));

  const base = calculateSaleTotals({
    items,
    discount: Number(discount) || 0,
    deliveryFee: Number(deliveryFee) || 0,
    otherCharges: Number(otherCharges) || 0,
    amountPaid: 0,
  });

  const amountPaid = editing
    ? original?.sale.amountPaid || 0
    : paymentStatus === "paid"
    ? base.total
    : paymentStatus === "unpaid"
    ? 0
    : Number(partialAmount) || 0;

  const totals = calculateSaleTotals({
    items,
    discount: Number(discount) || 0,
    deliveryFee: Number(deliveryFee) || 0,
    otherCharges: Number(otherCharges) || 0,
    amountPaid,
  });

  const bagging = Number(packagingCost) || 0;

  const stockProblems = rows
    .map((r) => {
      const p = productById.get(r.productId);
      return p && Number(r.quantity) > availableOf(p) ? `${p.label}: only ${availableOf(p)} in stock` : null;
    })
    .filter(Boolean);

  const chosenIds = rows.map((r) => r.productId).filter(Boolean);
  const hasDuplicate = new Set(chosenIds).size !== chosenIds.length;
  const incompleteRows = rows.some((r) => !r.productId || !(Number(r.quantity) >= 1) || r.sellingPrice === "");
  const discountTooHigh = totals.discount > totals.subtotal;
  const partialInvalid = !editing && paymentStatus === "partial" && !(amountPaid > 0 && amountPaid < base.total);
  const belowPaid = editing && base.total < amountPaid;

  const blocker = lockedReason
    ? lockedReason
    : belowPaid
    ? `The customer has already paid ${formatNaira(amountPaid)}, which is more than the new total. Refund the difference instead.`
    : incompleteRows
    ? "Choose a product, quantity and selling price for every row."
    : hasDuplicate
    ? "The same product appears twice. Increase its quantity instead."
    : stockProblems.length > 0
    ? stockProblems[0]
    : discountTooHigh
    ? "Discount cannot be more than the sale amount."
    : partialInvalid
    ? "For a part payment, enter an amount above 0 and below the total."
    : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (blocker || saving) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch(editing ? `/api/sales/${saleId}` : "/api/sales", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          customerName,
          customerPhone,
          items: rows.map((r) => ({
            productId: r.productId,
            quantity: Number(r.quantity),
            costPrice: Number(r.costPrice),
            sellingPrice: Number(r.sellingPrice),
          })),
          discount: Number(discount) || 0,
          deliveryFee: Number(deliveryFee) || 0,
          otherCharges: Number(otherCharges) || 0,
          packagingCost: Number(packagingCost) || 0,
          amountPaid,
          paymentMethod,
          dueDate: dueDate || null,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not save the sale.");
        setSaving(false);
        return;
      }

      try {
        if (!editing) window.localStorage.setItem("blaqo.baggingCost", packagingCost || "");
      } catch {}
      setCompleted(data.sale);
      setSaving(false);
    } catch {
      setError("Network problem. Please try again.");
      setSaving(false);
    }
  }

  function startAnother() {
    setCompleted(null);
    setDate(nowLocal());
    setCustomerName("");
    setCustomerPhone("");
    setRows([newRow()]);
    setDiscount("");
    setDeliveryFee("");
    setOtherCharges("");
    setPaymentMethod("cash");
    setPaymentStatus("paid");
    setPartialAmount("");
    setDueDate("");
    setNotes("");
    setError("");
    setProducts(null);
    loadProducts();
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{editing ? "Sale updated" : "Sale recorded"}</h1>
        <p className="mt-1 text-sm text-gray-500">{completed.orderNumber}</p>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-left">
          <SummaryRow label="Total" value={formatNaira(completed.total)} strong />
          <SummaryRow label="Gross profit" value={formatNaira(completed.profit)} tone="profit" />
          {completed.packagingCost > 0 && (
            <SummaryRow label="Profit after bagging" value={formatNaira(completed.profit - completed.packagingCost)} tone="profit" />
          )}
          <SummaryRow label="Amount paid" value={formatNaira(completed.amountPaid)} />
          {completed.balance > 0 && (
            <SummaryRow label="Balance owed" value={formatNaira(completed.balance)} tone="danger" />
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/receipt/${completed._id}`}
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Receipt className="h-4 w-4" />
            View receipt
          </Link>
          {editing ? (
            <Link
              href="/sales"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to sales
            </Link>
          ) : (
            <button
              type="button"
              onClick={startAnother}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Record another sale
            </button>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{editing ? `Edit ${original?.sale.orderNumber || "sale"}` : "Add Sale"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {editing ? "Stock, profit and totals are recalculated when you save." : "Enter the sale and everything is calculated for you."}
        </p>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={loadProducts} className="font-medium underline">Try again</button>
        </div>
      )}

      {products && products.length === 0 && !loadError && !editing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have no products yet.{" "}
          <Link href="/products" className="font-medium underline">Add a product first</Link>, then come back to record a sale.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Sale info */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Sale information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sale ID" htmlFor="saleId">
                <input id="saleId" disabled value={editing ? original?.sale.orderNumber || "" : "Assigned when saved (SALE-000001...)"} className={`${inputClass} bg-gray-50 text-gray-400`} />
              </Field>
              <Field label="Date and time" htmlFor="date">
                <input id="date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Customer name" htmlFor="customerName" hint="Leave empty for a walk-in customer">
                <input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Customer phone number" htmlFor="customerPhone">
                <input id="customerPhone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </section>

          {/* Products */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Products</h2>

            {products === null ? (
              <div className="h-24 animate-pulse rounded-xl bg-gray-200/70" />
            ) : (
              <div className="space-y-4">
                {rows.map((r, idx) => {
                  const p = productById.get(r.productId);
                  const qty = Number(r.quantity) || 0;
                  const lineRevenue = qty * (Number(r.sellingPrice) || 0);
                  const lineCost = qty * (Number(r.costPrice) || 0);
                  const lineProfit = lineRevenue - lineCost;
                  const overStock = p && qty > availableOf(p);

                  return (
                    <div key={r.key} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Item {idx + 1}</span>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                            aria-label="Remove item"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Product" htmlFor={`product-${r.key}`} hint={p ? `Category: ${p.category}` : undefined}>
                            <select
                              id={`product-${r.key}`}
                              value={r.productId}
                              onChange={(e) => pickProduct(r.key, e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Select a product</option>
                              {products.map((prod) => (
                                <option key={prod._id} value={prod._id} disabled={availableOf(prod) <= 0}>
                                  {prod.label} ({availableOf(prod) <= 0 ? "out of stock" : `${availableOf(prod)} in stock`})
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <Field label="Quantity" htmlFor={`qty-${r.key}`}>
                          <input
                            id={`qty-${r.key}`}
                            type="number"
                            min="1"
                            step="1"
                            value={r.quantity}
                            onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                        <div />
                        <Field label="Cost price per item (₦)" htmlFor={`cost-${r.key}`}>
                          <input
                            id={`cost-${r.key}`}
                            type="number"
                            min="0"
                            step="any"
                            value={r.costPrice}
                            onChange={(e) => updateRow(r.key, { costPrice: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Selling price per item (₦)" htmlFor={`sell-${r.key}`}>
                          <input
                            id={`sell-${r.key}`}
                            type="number"
                            min="0"
                            step="any"
                            value={r.sellingPrice}
                            placeholder="How much did you sell it for?"
                            onChange={(e) => updateRow(r.key, { sellingPrice: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                      </div>

                      {overStock && (
                        <p className="mt-3 text-sm text-red-600">Only {availableOf(p)} in stock. Reduce the quantity.</p>
                      )}

                      {r.productId && r.sellingPrice !== "" && (
                        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-4">
                          <div>
                            <dt className="text-xs text-gray-400">Quantity</dt>
                            <dd className="font-medium text-gray-900">{qty}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-400">Revenue</dt>
                            <dd className="font-medium text-gray-900">{formatNaira(lineRevenue)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-400">Cost</dt>
                            <dd className="font-medium text-gray-900">{formatNaira(lineCost)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-400">Gross profit</dt>
                            <dd className={`font-semibold ${lineProfit < 0 ? "text-red-600" : "text-green-700"}`}>
                              {formatNaira(lineProfit)}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setRows((rs) => [...rs, newRow()])}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Add another product
                </button>
              </div>
            )}
          </section>

          {/* Charges and payment */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Charges and payment</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Discount (₦)" htmlFor="discount">
                <input id="discount" type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Delivery fee (₦)" htmlFor="deliveryFee">
                <input id="deliveryFee" type="number" min="0" step="any" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Other charges (₦)" htmlFor="otherCharges">
                <input id="otherCharges" type="number" min="0" step="any" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Bagging cost (₦)" htmlFor="packagingCost" hint="What the bag cost you. Not charged to the customer.">
                <input id="packagingCost" type="number" min="0" step="any" value={packagingCost} onChange={(e) => setPackagingCost(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Payment method" htmlFor="paymentMethod">
                <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
              {editing ? (
                <Field label="Already paid" htmlFor="alreadyPaid" hint="Payments already received stay as they are.">
                  <input id="alreadyPaid" disabled value={formatNaira(amountPaid)} className={`${inputClass} bg-gray-50 text-gray-500`} />
                </Field>
              ) : (
              <Field label="Payment status" htmlFor="paymentStatus">
                <select id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={inputClass}>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              )}
              {!editing && paymentStatus === "partial" && (
                <Field label="Amount paid so far (₦)" htmlFor="partialAmount">
                  <input id="partialAmount" type="number" min="0" step="any" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} className={inputClass} />
                </Field>
              )}
              {(editing ? totals.balance > 0 : paymentStatus !== "paid") && (
                <Field label="Payment due date" htmlFor="dueDate">
                  <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                </Field>
              )}
              <div className="sm:col-span-3">
                <Field label="Notes" htmlFor="notes">
                  <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </div>
          </section>
        </div>

        {/* Live summary */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-8">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Sale summary</h2>
            <div className="divide-y divide-gray-100">
              <div className="pb-2">
                <SummaryRow label="Subtotal" value={formatNaira(totals.subtotal)} />
                {totals.discount > 0 && <SummaryRow label="Discount" value={`- ${formatNaira(totals.discount)}`} />}
                {totals.deliveryFee > 0 && <SummaryRow label="Delivery fee" value={formatNaira(totals.deliveryFee)} />}
                {totals.otherCharges > 0 && <SummaryRow label="Other charges" value={formatNaira(totals.otherCharges)} />}
                <SummaryRow label="Total" value={formatNaira(totals.total)} strong />
              </div>
              <div className="py-2">
                <SummaryRow label="Revenue" value={formatNaira(totals.revenue)} />
                <SummaryRow label="Cost of goods" value={formatNaira(totals.totalCost)} />
                <SummaryRow
                  label="Gross profit"
                  value={formatNaira(totals.profit)}
                  strong
                  tone={totals.profit < 0 ? "danger" : "profit"}
                />
                {bagging > 0 && <SummaryRow label="Bagging cost" value={`- ${formatNaira(bagging)}`} />}
                {bagging > 0 && (
                  <SummaryRow
                    label="Profit after bagging"
                    value={formatNaira(totals.profit - bagging)}
                    strong
                    tone={totals.profit - bagging < 0 ? "danger" : "profit"}
                  />
                )}
              </div>
              <div className="pt-2">
                <SummaryRow label="Amount paid" value={formatNaira(totals.amountPaid)} />
                <SummaryRow
                  label="Balance"
                  value={formatNaira(totals.balance)}
                  tone={totals.balance > 0 ? "danger" : undefined}
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {blocker && !error && <p className="mt-4 text-sm text-amber-700">{blocker}</p>}

            <button
              type="submit"
              disabled={saving || Boolean(blocker) || !products || (!editing && products.length === 0) || (editing && !original)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : editing ? "Save changes" : "Save sale"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
