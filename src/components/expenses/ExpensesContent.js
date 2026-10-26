"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Search, Trash2, Lock } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExpenseFormModal, { EXPENSE_CATEGORIES, METHODS } from "./ExpenseFormModal";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));

const KIND_BADGES = {
  operating: null,
  packaging: { label: "Bagging", className: "bg-purple-50 text-purple-700" },
  inbound: { label: "Delivery cost", className: "bg-sky-50 text-sky-700" },
};

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{formatNaira(value)}</p>
    </div>
  );
}

function Actions({ expense, onEdit, onDelete }) {
  if (expense.kind !== "operating") {
    return (
      <span title="Created automatically. Change it from the sale or delivery." className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Lock className="h-3.5 w-3.5" /> Automatic
      </span>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <button type="button" title="Edit" aria-label="Edit expense" onClick={() => onEdit(expense)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" title="Delete" aria-label="Delete expense" onClick={() => onDelete(expense)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ExpensesContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState(null); // { type: "form" | "delete", expense }
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, category, kind, method, from, to]);

  const load = useCallback(async () => {
    setError("");
    try {
      const p = new URLSearchParams();
      if (debounced) p.set("q", debounced);
      if (category) p.set("category", category);
      if (kind) p.set("kind", kind);
      if (method) p.set("method", method);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      p.set("page", String(page));

      const res = await fetch(`/api/expenses?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load expenses.");
      setData(json);
    } catch (err) {
      setError(err.message || "Could not load expenses.");
      setData(
        (d) =>
          d ?? {
            expenses: [],
            count: 0,
            page: 1,
            pages: 1,
            summary: { today: 0, week: 0, month: 0, all: 0, deliveryMonth: 0 },
            byCategory: [],
          }
      );
    }
  }, [debounced, category, kind, method, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  function saved(message) {
    setModal(null);
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
    load();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${modal.expense._id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not delete the expense.");
      setDeleting(false);
      saved("Expense deleted.");
    } catch (err) {
      setDeleting(false);
      setModal(null);
      setError(err.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setKind("");
    setMethod("");
    setFrom("");
    setTo("");
  }

  const loading = data === null;
  const hasFilters = Boolean(debounced || category || kind || method || from || to);
  const chartMax = data?.byCategory?.[0]?.total || 0;
  const chartTotal = data?.byCategory?.reduce((n, c) => n + c.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Money your business spends. These come off your profit.</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: "form", expense: null })}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
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

      {/* Totals */}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Today's expenses" value={data.summary.today} />
            <SummaryCard label="This week" value={data.summary.week} />
            <SummaryCard label="This month" value={data.summary.month} />
            <SummaryCard label="Total expenses" value={data.summary.all} />
          </div>
          <p className="text-xs text-gray-500">
            Delivery and transport costs you enter in Receive Stock are already inside your product costs, so they are not counted again here
            {data.summary.deliveryMonth > 0 && <> (this month: {formatNaira(data.summary.deliveryMonth)})</>}.
          </p>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200/70" />
          ))}
        </div>
      )}

      {/* By category */}
      {data && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Expenses by category</h2>
            <span className="text-xs text-gray-400">{from || to ? "For the dates you selected" : "All time"}</span>
          </div>
          {data.byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No expenses to show yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.byCategory.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.category}</span>
                    <span className="font-medium text-gray-900">
                      {formatNaira(c.total)}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {chartTotal > 0 ? Math.round((c.total / chartTotal) * 100) : 0}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${chartMax > 0 ? Math.max((c.total / chartMax) * 100, 2) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="f-from">From</label>
            <input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="f-to">To</label>
            <input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="f-cat">Category</label>
            <select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="f-kind">Type</label>
            <select id="f-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="business">Business expenses</option>
              <option value="delivery">Delivery costs</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="f-method">Payment method</label>
            <select id="f-method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              <option value="">All methods</option>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
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
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/70" />
          ))}
        </div>
      )}

      {data && data.expenses.length === 0 && !error && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Receipt className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-gray-900">{hasFilters ? "No expenses match your filters" : "No expenses yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {hasFilters ? "Try changing or clearing the filters." : "Record rent, advertising, staff and anything else the business spends on."}
          </p>
          {!hasFilters && (
            <button
              type="button"
              onClick={() => setModal({ type: "form", expense: null })}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </button>
          )}
        </div>
      )}

      {/* Desktop table */}
      {data && data.expenses.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Expense</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Method</th>
                <th className="px-3 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.expenses.map((e) => {
                const badge = KIND_BADGES[e.kind];
                return (
                  <tr key={e._id} className="hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">{formatDate(e.date)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">
                        {e.name}
                        {badge && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                        )}
                      </p>
                      {e.description && <p className="text-xs text-gray-500">{e.description}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{e.category}</td>
                    <td className="px-3 py-3 text-gray-600">{METHOD_LABELS[e.paymentMethod]}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-gray-900">{formatNaira(e.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <Actions expense={e} onEdit={(x) => setModal({ type: "form", expense: x })} onDelete={(x) => setModal({ type: "delete", expense: x })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {data && data.expenses.length > 0 && (
        <div className="space-y-3 md:hidden">
          {data.expenses.map((e) => {
            const badge = KIND_BADGES[e.kind];
            return (
              <div key={e._id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{e.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(e.date)} · {e.category} · {METHOD_LABELS[e.paymentMethod]}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">{formatNaira(e.amount)}</p>
                </div>
                {badge && (
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                )}
                {e.description && <p className="mt-2 text-xs text-gray-500">{e.description}</p>}
                <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                  <Actions expense={e} onEdit={(x) => setModal({ type: "form", expense: x })} onDelete={(x) => setModal({ type: "delete", expense: x })} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.page} of {data.pages}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={data.page >= data.pages} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal?.type === "form" && (
          <ExpenseFormModal
            key="form"
            expense={modal.expense}
            onClose={() => setModal(null)}
            onSaved={() => saved(modal.expense ? "Expense updated." : "Expense added.")}
          />
        )}
        {modal?.type === "delete" && (
          <ConfirmDialog
            key="delete"
            title="Delete expense?"
            message={`"${modal.expense.name}" (${formatNaira(modal.expense.amount)}) will be removed and your profit figures will update.`}
            confirmLabel="Delete"
            danger
            loading={deleting}
            onConfirm={confirmDelete}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
