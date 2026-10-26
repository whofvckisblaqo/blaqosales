"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate, startOfDay, todayStr } from "@/lib/dates";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom dates" },
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Line({ label, value, note, strong, tone, indent }) {
  const toneClass = tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-gray-900";
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${indent ? "pl-4" : ""}`}>
      <div className="min-w-0">
        <p className={strong ? "text-sm font-semibold text-gray-900" : "text-sm text-gray-600"}>{label}</p>
        {note && <p className="text-xs text-gray-400">{note}</p>}
      </div>
      <p className={`shrink-0 ${strong ? "text-lg font-semibold" : "text-sm font-medium"} ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ProfitLossContent() {
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (period === "custom" && (!from || !to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({ period });
      if (period === "custom") {
        p.set("from", from);
        p.set("to", to);
      }
      const res = await fetch(`/api/profit-loss?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load the report.");
      setData(json);
    } catch (err) {
      setError(err.message || "Could not load the report.");
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel = data
    ? data.range.from === data.range.to
      ? formatDate(startOfDay(data.range.from))
      : `${formatDate(startOfDay(data.range.from))} to ${formatDate(startOfDay(data.range.to))}`
    : "";

  const noActivity = data && data.revenue === 0 && data.expenses === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profit & Loss</h1>
        <p className="mt-1 text-sm text-gray-500">What the business earned, what it cost, and what is left.</p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 sm:w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                period === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <div>
              <label htmlFor="pl-from" className="mb-1 block text-xs text-gray-500">From</label>
              <input id="pl-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pl-to" className="mb-1 block text-xs text-gray-500">To</label>
              <input id="pl-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {period === "custom" && (!from || !to) && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Choose a start and end date to see the report.
        </div>
      )}

      {loading && !data && <div className="h-96 animate-pulse rounded-2xl bg-gray-200/70" />}

      {data && !(period === "custom" && (!from || !to)) && (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{rangeLabel}</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {noActivity && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No sales or expenses in this period.
            </div>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white px-5">
            <div className="divide-y divide-gray-100">
              <Line label="Revenue" note={`${data.orders} order${data.orders === 1 ? "" : "s"} · ${data.productsSold} product${data.productsSold === 1 ? "" : "s"} sold`} value={formatNaira(data.revenue)} strong />
              <Line label="Cost of goods sold" note="What the products you sold cost, including bringing them in" value={`- ${formatNaira(data.costOfGoods)}`} />
              <Line
                label="Gross profit"
                note={data.revenue > 0 ? `${data.grossMargin}% of revenue` : undefined}
                value={formatNaira(data.grossProfit)}
                strong
                tone={data.grossProfit < 0 ? "bad" : "good"}
              />

              <div>
                <Line label="Expenses" note="Rent, staff, light, bagging and other running costs" value={`- ${formatNaira(data.expenses)}`} />
                {data.expensesByCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between gap-4 py-1.5 pl-4 text-sm">
                    <span className="text-gray-500">{c.category}</span>
                    <span className="text-gray-600">{formatNaira(c.total)}</span>
                  </div>
                ))}
                {data.expensesByCategory.length > 0 && <div className="pb-2" />}
              </div>

              <Line
                label="Net profit"
                note={data.revenue > 0 ? `${data.netMargin}% of revenue` : undefined}
                value={formatNaira(data.netProfit)}
                strong
                tone={data.netProfit < 0 ? "bad" : "good"}
              />
            </div>
          </section>

          <p className="text-xs text-gray-500">
            Revenue is the goods you sold after discounts. Delivery fees charged to customers are not counted as revenue. Money still owed to
            you is included in revenue because the sale has been made; see Customers for what is outstanding.
          </p>
        </div>
      )}
    </div>
  );
}
