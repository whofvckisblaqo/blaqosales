"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Eye, FileText, Pencil, Plus, Receipt, Search, Trash2, Undo2 } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SaleDetailModal from "./SaleDetailModal";
import RefundModal from "./RefundModal";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const METHOD_LABELS = { cash: "Cash", transfer: "Transfer", pos: "POS", card: "Card", other: "Other" };

const STATUS_STYLES = {
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
  partial: { label: "Partially Paid", className: "bg-amber-50 text-amber-700" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700" },
};

function StatusBadge({ sale }) {
  if (sale.status === "refunded") {
    return <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Refunded</span>;
  }
  const overdue = sale.isOverdue;
  const s = overdue ? { label: "Overdue", className: "bg-red-100 text-red-800" } : STATUS_STYLES[sale.paymentStatus];
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
      {sale.status === "partially_refunded" && (
        <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Part refunded</span>
      )}
    </span>
  );
}

function productSummary(items) {
  if (!items.length) return "—";
  const first = items[0].productName;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

// Figures after any refunds.
const revenueOf = (sale) => sale.subtotal - sale.discount - (sale.refundedRevenue || 0);
const costOf = (sale) => sale.totalCost - (sale.refundedCost || 0);
const profitOf = (sale) => sale.profit - (sale.refundedProfit || 0);
const quantityOf = (sale) => sale.items.reduce((n, i) => n + i.quantity - (i.returnedQuantity || 0), 0);

function SummaryCard({ label, value, tone }) {
  const toneClass = tone === "profit" ? "text-green-700" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function SalesContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [product, setProduct] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [viewing, setViewing] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Opened from the global search: /sales?q=SALE-000012
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProducts((d.products || []).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  // Any filter change goes back to page 1.
  useEffect(() => {
    setPage(1);
  }, [debounced, from, to, product, method, status, sort]);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("q", debounced);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (product) p.set("product", product);
    if (method) p.set("method", method);
    if (status) p.set("status", status);
    p.set("sort", sort);
    return p;
  }, [debounced, from, to, product, method, status, sort]);

  const load = useCallback(async () => {
    setError("");
    try {
      const p = filterParams();
      p.set("page", String(page));
      const res = await fetch(`/api/sales?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load sales.");
      setData(json);
    } catch (err) {
      setError(err.message || "Could not load sales.");
      setData((d) => d ?? { sales: [], count: 0, page: 1, pages: 1, summary: { revenue: 0, cost: 0, profit: 0, balance: 0 } });
    }
  }, [filterParams, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/sales/${deleting._id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not delete the sale.");
      setNotice(`${deleting.orderNumber} deleted and its stock was put back.`);
      setTimeout(() => setNotice(""), 4000);
      setDeleting(null);
      setDeleteBusy(false);
      load();
    } catch (err) {
      setDeleteBusy(false);
      setDeleting(null);
      setError(err.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setProduct("");
    setMethod("");
    setStatus("");
    setSort("newest");
  }

  const loading = data === null;
  const hasFilters = Boolean(debounced || from || to || product || method || status);
  const exportQuery = filterParams().toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>
          <p className="mt-1 text-sm text-gray-500">Every sale you have recorded.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/export/sales?format=csv&${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
          <a
            href={`/api/export/sales?format=xlsx&${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Excel
          </a>
          <a
            href={`/api/export/sales?format=pdf&${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </a>
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Sale
          </Link>
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {/* Totals for the current filter */}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryCard label="Sales" value={data.count} />
          <SummaryCard label="Revenue" value={formatNaira(data.summary.revenue)} />
          <SummaryCard label="Cost" value={formatNaira(data.summary.cost)} />
          <SummaryCard label="Profit" value={formatNaira(data.summary.profit)} tone="profit" />
          <SummaryCard label="Outstanding" value={formatNaira(data.summary.balance)} tone={data.summary.balance > 0 ? "danger" : undefined} />
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID, customer, phone or product"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="from">From</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="to">To</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="product">Product</label>
            <select id="product" value={product} onChange={(e) => setProduct(e.target.value)} className={inputClass}>
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="method">Payment method</label>
            <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              <option value="">All methods</option>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="status">Payment status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)} className={inputClass}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest sale</option>
              <option value="lowest">Lowest sale</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear filters
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/70" />
          ))}
        </div>
      )}

      {data && data.sales.length === 0 && !error && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Receipt className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-gray-900">{hasFilters ? "No sales match your filters" : "No sales yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {hasFilters ? "Try changing or clearing the filters." : "Record your first sale and it will appear here."}
          </p>
          {!hasFilters && (
            <Link href="/sales/new" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" />
              Add Sale
            </Link>
          )}
        </div>
      )}

      {/* Desktop table */}
      {data && data.sales.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Product</th>
                <th className="px-3 py-3 text-right font-medium">Qty</th>
                <th className="px-3 py-3 text-right font-medium">Revenue</th>
                <th className="px-3 py-3 text-right font-medium">Cost</th>
                <th className="px-3 py-3 text-right font-medium">Profit</th>
                <th className="px-3 py-3 font-medium">Method</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.sales.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{s.orderNumber}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {formatDate(s.date)}
                    <span className="block text-xs text-gray-400">{formatTime(s.date)}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{s.customerName}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-gray-700">{productSummary(s.items)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{quantityOf(s)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900">{formatNaira(revenueOf(s))}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-gray-600">{formatNaira(costOf(s))}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-medium ${profitOf(s) < 0 ? "text-red-600" : "text-green-700"}`}>
                    {formatNaira(profitOf(s))}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{METHOD_LABELS[s.paymentMethod]}</td>
                  <td className="px-3 py-3"><StatusBadge sale={s} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" title="View details" aria-label="View details" onClick={() => setViewing(s)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                        <Eye className="h-4 w-4" />
                      </button>
                      {s.status !== "refunded" && (
                        <Link href={`/sales/${s._id}/edit`} title="Edit" aria-label="Edit sale" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      {s.status !== "refunded" && (
                        <button type="button" title="Refund" aria-label="Refund sale" onClick={() => setRefunding(s)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      <Link href={`/receipt/${s._id}`} target="_blank" title="Receipt" aria-label="Open receipt" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                        <FileText className="h-4 w-4" />
                      </Link>
                      <button type="button" title="Delete" aria-label="Delete sale" onClick={() => setDeleting(s)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile and tablet cards */}
      {data && data.sales.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {data.sales.map((s) => (
            <div key={s._id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{s.orderNumber}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(s.date)} · {formatTime(s.date)}
                  </p>
                </div>
                <StatusBadge sale={s} />
              </div>
              <p className="mt-3 truncate text-sm text-gray-700">{productSummary(s.items)}</p>
              <p className="text-xs text-gray-500">
                {s.customerName} · {quantityOf(s)} item{quantityOf(s) === 1 ? "" : "s"} · {METHOD_LABELS[s.paymentMethod]}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Revenue</dt>
                  <dd className="font-medium text-gray-900">{formatNaira(revenueOf(s))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Cost</dt>
                  <dd className="text-gray-700">{formatNaira(costOf(s))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Profit</dt>
                  <dd className={`font-medium ${profitOf(s) < 0 ? "text-red-600" : "text-green-700"}`}>{formatNaira(profitOf(s))}</dd>
                </div>
              </dl>
              <div className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-3">
                <button type="button" onClick={() => setViewing(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                  <Eye className="h-4 w-4" /> View
                </button>
                {s.status !== "refunded" && (
                  <Link href={`/sales/${s._id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                )}
                {s.status !== "refunded" && (
                  <button type="button" onClick={() => setRefunding(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                    <Undo2 className="h-4 w-4" /> Refund
                  </button>
                )}
                <Link href={`/receipt/${s._id}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                  <FileText className="h-4 w-4" /> Receipt
                </Link>
                <button type="button" onClick={() => setDeleting(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.page} of {data.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={data.page >= data.pages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewing && (
          <SaleDetailModal key="view" saleId={viewing._id} orderNumber={viewing.orderNumber} onClose={() => setViewing(null)} />
        )}
        {refunding && (
          <RefundModal
            key="refund"
            saleId={refunding._id}
            orderNumber={refunding.orderNumber}
            onClose={() => setRefunding(null)}
            onDone={(n) => {
              setRefunding(null);
              setNotice(`Refund saved on ${n}.`);
              setTimeout(() => setNotice(""), 4000);
              load();
            }}
          />
        )}
        {deleting && (
          <ConfirmDialog
            key="delete"
            title="Delete this sale?"
            message={`${deleting.orderNumber} will be removed and the products in it will be added back to your stock. This cannot be undone.`}
            confirmLabel="Delete sale"
            danger
            loading={deleteBusy}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
