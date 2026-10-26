"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Eye,
  Pencil,
  LineChart,
  PackageSearch,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";
import { RANGE_OPTIONS } from "@/lib/dashboardRange";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SaleDetailModal from "@/components/sales/SaleDetailModal";
import BarChart from "./BarChart";

const QUICK_ACTIONS = [
  { label: "Add Sale", href: "/sales/new", primary: true },
  { label: "Add Product", href: "/products" },
  { label: "Add Expense", href: "/expenses" },
  { label: "Add Customer", href: "/customers?add=1" },
];

const STATUS_STYLES = {
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
  partial: { label: "Partially Paid", className: "bg-amber-50 text-amber-700" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700" },
};

function StatCard({ label, value, note, icon: Icon, tone }) {
  const toneClass = tone === "profit" ? (value < 0 ? "text-red-600" : "text-green-700") : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${toneClass}`}>{formatNaira(value)}</p>
      <p className="mt-1 text-xs text-gray-400">{note}</p>
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-200/70 ${className}`} />;
}

function EmptyPanel({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-gray-500">{text}</p>
    </div>
  );
}

function productSummary(items) {
  if (!items.length) return "—";
  return items.length > 1 ? `${items[0].productName} +${items.length - 1} more` : items[0].productName;
}

export default function DashboardContent() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/dashboard?range=${range}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load the dashboard.");
      setData(json);
    } catch (err) {
      setError(err.message || "Could not load the dashboard.");
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/sales/${deleting._id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not delete the sale.");
      setDeleting(null);
      setDeleteBusy(false);
      load();
    } catch (err) {
      setDeleting(null);
      setDeleteBusy(false);
      setError(err.message);
    }
  }

  const hasChartData = data?.chart.points.some((p) => p.sales !== 0 || p.profit !== 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">How your business is doing.</p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:self-auto"
        >
          <BarChart3 className="h-4 w-4" />
          View Reports
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        {QUICK_ACTIONS.map(({ label, href, primary }) => (
          <Link
            key={label}
            href={href}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              primary ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Plus className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {/* Today */}
      {data ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's Sales" value={data.today.sales} note={`${data.today.orders} order${data.today.orders === 1 ? "" : "s"}`} icon={ShoppingCart} />
          <StatCard label="Today's Profit" value={data.today.profit} note="Sales minus cost of goods" icon={TrendingUp} tone="profit" />
          <StatCard label="Today's Expenses" value={data.today.expenses} note="Money spent today" icon={Receipt} />
          <StatCard label="Today's Net Profit" value={data.today.net} note="Profit minus expenses" icon={Wallet} tone="profit" />
        </section>
      ) : (
        !error && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </section>
        )
      )}

      {/* Week and month */}
      {data && (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">This week and month</h2>
          </div>
          <dl className="grid gap-px bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Sales this week", formatNaira(data.week.sales)],
              ["Sales this month", formatNaira(data.month.sales)],
              ["Profit this week", formatNaira(data.week.profit)],
              ["Profit this month", formatNaira(data.month.profit)],
              ["Expenses this month", formatNaira(data.month.expenses)],
              ["Net profit this month", formatNaira(data.month.net)],
              ["Orders this month", data.month.orders],
              ["Products sold this month", data.month.productsSold],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-5 py-4">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Outstanding payments (owed to you)</span>
              <span className={`font-semibold ${data.outstanding > 0 ? "text-red-600" : "text-gray-900"}`}>{formatNaira(data.outstanding)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Sales and profit</h2>
          <div className="flex gap-1.5 overflow-x-auto">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                  range === r.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!data ? (
          <div className="p-5"><Skeleton className="h-64" /></div>
        ) : !hasChartData ? (
          <EmptyPanel icon={LineChart} title="No sales in this period" text="Your sales and profit charts will appear here once you record sales." />
        ) : (
          <div className="grid gap-px bg-gray-100 lg:grid-cols-2">
            <div className="bg-white p-5">
              <p className="text-xs text-gray-500">Sales</p>
              <p className="mb-4 text-xl font-semibold text-gray-900">{formatNaira(data.chart.totalSales)}</p>
              <BarChart points={data.chart.points} valueKey="sales" barClass="bg-brand-500" />
            </div>
            <div className="bg-white p-5">
              <p className="text-xs text-gray-500">Profit</p>
              <p className={`mb-4 text-xl font-semibold ${data.chart.totalProfit < 0 ? "text-red-600" : "text-green-700"}`}>{formatNaira(data.chart.totalProfit)}</p>
              <BarChart points={data.chart.points} valueKey="profit" barClass="bg-green-500" />
            </div>
          </div>
        )}
      </section>

      {/* Recent sales */}
      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent sales</h2>
          <Link href="/sales" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
        </div>

        {!data ? (
          <div className="p-5"><Skeleton className="h-32" /></div>
        ) : data.recent.length === 0 ? (
          <EmptyPanel icon={PackageSearch} title="No sales recorded" text="Add your first sale and it will show up here with its profit." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 text-right font-medium">Qty</th>
                    <th className="px-3 py-3 text-right font-medium">Amount</th>
                    <th className="px-3 py-3 text-right font-medium">Profit</th>
                    <th className="px-3 py-3 font-medium">Payment</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recent.map((s) => {
                    const st = s.isOverdue ? { label: "Overdue", className: "bg-red-100 text-red-800" } : STATUS_STYLES[s.paymentStatus];
                    return (
                      <tr key={s._id} className="hover:bg-gray-50/60">
                        <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                          {formatDate(s.date)}
                          <span className="block text-xs text-gray-400">{formatTime(s.date)}</span>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-3 text-gray-900">{productSummary(s.items)}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{s.items.reduce((n, i) => n + i.quantity, 0)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900">{formatNaira(s.subtotal - s.discount - (s.refundedRevenue || 0))}</td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right font-medium ${s.profit - (s.refundedProfit || 0) < 0 ? "text-red-600" : "text-green-700"}`}>{formatNaira(s.profit - (s.refundedProfit || 0))}</td>
                        <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span></td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" title="View details" aria-label="View details" onClick={() => setViewing(s)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Eye className="h-4 w-4" /></button>
                            <Link href={`/sales/${s._id}/edit`} title="Edit" aria-label="Edit sale" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Pencil className="h-4 w-4" /></Link>
                            <button type="button" title="Delete" aria-label="Delete sale" onClick={() => setDeleting(s)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {data.recent.map((s) => {
                const st = s.isOverdue ? { label: "Overdue", className: "bg-red-100 text-red-800" } : STATUS_STYLES[s.paymentStatus];
                return (
                  <div key={s._id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{productSummary(s.items)}</p>
                        <p className="text-xs text-gray-500">{formatDate(s.date)} · {formatTime(s.date)}</p>
                      </div>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-900">{formatNaira(s.subtotal - s.discount - (s.refundedRevenue || 0))}</span>
                      <span className={`font-medium ${s.profit - (s.refundedProfit || 0) < 0 ? "text-red-600" : "text-green-700"}`}>Profit {formatNaira(s.profit - (s.refundedProfit || 0))}</span>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <button type="button" onClick={() => setViewing(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"><Eye className="h-4 w-4" /> View</button>
                      <Link href={`/sales/${s._id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"><Pencil className="h-4 w-4" /> Edit</Link>
                      <button type="button" onClick={() => setDeleting(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <AnimatePresence>
        {viewing && <SaleDetailModal key="view" saleId={viewing._id} orderNumber={viewing.orderNumber} onClose={() => setViewing(null)} />}
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
