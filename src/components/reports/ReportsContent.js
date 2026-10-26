"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import BarChart from "@/components/dashboard/BarChart";
import { formatNaira } from "@/lib/money";
import CapitalEntries from "@/components/capital/CapitalEntries";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const TABS = [
  { value: "sales", label: "Sales", mode: "range" },
  { value: "profit", label: "Profit", mode: "range" },
  { value: "products", label: "Products", mode: "range" },
  { value: "customers", label: "Customers", mode: "range" },
  { value: "best-sellers", label: "Best sellers", mode: "range" },
  { value: "monthly", label: "Monthly summary", mode: "month" },
  { value: "closing", label: "Daily closing", mode: "day" },
  { value: "cash-flow", label: "Cash flow", mode: "range" },
];

function nigeriaToday() {
  return new Date(Date.now() + 3600000).toISOString().slice(0, 10);
}
function monthStart() {
  return `${nigeriaToday().slice(0, 8)}01`;
}
function weekStart() {
  const d = new Date(`${nigeriaToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function fmt(value, kind) {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "money") return formatNaira(value);
  if (kind === "pct") return `${Number(value).toFixed(1)}%`;
  if (kind === "int") return Number(value).toLocaleString("en-NG");
  return String(value);
}

function Card({ item }) {
  const tone = item.tone === "profit" ? "text-green-700" : item.tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{item.label}</p>
      <p className={`mt-0.5 break-words text-lg font-semibold ${tone}`}>{fmt(item.value, item.kind)}</p>
    </div>
  );
}

function DataTable({ columns, rows, totals }) {
  if (rows.length === 0) return <p className="px-5 py-10 text-center text-sm text-gray-500">Nothing to show for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 text-gray-800 ${c.align === "right" ? "whitespace-nowrap text-right" : ""} ${c.wide ? "min-w-[160px]" : ""}`}>
                  {fmt(r[c.key], c.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "whitespace-nowrap text-right" : ""}`}>{fmt(totals[c.key], c.kind)}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function ReportsContent() {
  const [tab, setTab] = useState("sales");
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(nigeriaToday());
  const [month, setMonth] = useState(nigeriaToday().slice(0, 7));
  const [day, setDay] = useState(nigeriaToday());
  const [rank, setRank] = useState("units");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mode = TABS.find((t) => t.value === tab).mode;
  const apiType = tab;

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (mode === "range") {
      p.set("from", from);
      p.set("to", to);
    }
    if (mode === "month") p.set("month", month);
    if (mode === "day") p.set("day", day);
    if (tab === "best-sellers") p.set("rank", rank);
    return p.toString();
  }, [mode, from, to, month, day, rank, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/${apiType}?${query}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load the report.");
      setReport(json.report);
    } catch (err) {
      setError(err.message || "Could not load the report.");
      setReport(null);
    }
    setLoading(false);
  }, [apiType, query]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(m) {
    setNotice(m);
    setTimeout(() => setNotice(""), 3500);
  }

  function applyPreset(value) {
    setPreset(value);
    const today = nigeriaToday();
    if (value === "today") { setFrom(today); setTo(today); }
    if (value === "week") { setFrom(weekStart()); setTo(today); }
    if (value === "month") { setFrom(monthStart()); setTo(today); }
    if (value === "year") { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); }
  }

  const exportLink = (format) => `/api/export/${apiType}?format=${format}&${query}`;

  const chartPoints = (key) =>
    report?.chart ? report.chart.labels.map((l, i) => ({ key: i, label: l, title: l, [key]: report.chart[key][i] })) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Understand how the business is doing, then export it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["csv", "xlsx", "pdf"].map((f) => (
            <a key={f} href={exportLink(f)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" />
              {f === "xlsx" ? "Excel" : f.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        {mode === "range" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="preset">Period</label>
              <select id="preset" value={preset} onChange={(e) => applyPreset(e.target.value)} className={inputClass}>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="from">From</label>
              <input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="to">To</label>
              <input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className={inputClass} />
            </div>
          </>
        )}
        {mode === "month" && (
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="month">Month</label>
            <input id="month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputClass} />
          </div>
        )}
        {mode === "day" && (
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="day">Day</label>
            <input id="day" type="date" value={day} max={nigeriaToday()} onChange={(e) => e.target.value && setDay(e.target.value)} className={inputClass} />
          </div>
        )}
        {tab === "best-sellers" && (
          <div>
            <label className="mb-1 block text-xs text-gray-500" htmlFor="rank">Rank by</label>
            <select id="rank" value={rank} onChange={(e) => setRank(e.target.value)} className={inputClass}>
              <option value="units">Units sold</option>
              <option value="revenue">Revenue</option>
              <option value="profit">Profit</option>
            </select>
          </div>
        )}
      </div>

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {loading && !report && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />)}</div>}

      {report && (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
            <p className="text-sm text-gray-500">{report.subtitle}</p>
          </div>

          {report.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {report.summary.map((s) => <Card key={s.label} item={s} />)}
            </div>
          )}

          {report.chart && tab !== "best-sellers" && report.rows.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">{report.chart.aLabel}</h3>
                <BarChart points={chartPoints("a")} valueKey="a" barClass="bg-brand-500" />
              </section>
              {report.chart.b && (
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">{report.chart.bLabel}</h3>
                  <BarChart points={chartPoints("b")} valueKey="b" barClass="bg-green-500" />
                </section>
              )}
            </div>
          )}

          {report.type === "closing" && <ClosingPanel report={report} day={day} onChanged={(m) => { flash(m); load(); }} />}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <DataTable columns={report.columns} rows={report.rows} totals={report.totals} />
          </section>

          {report.type === "cash-flow" && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                {report.extraTables.map((t) => (
                  <section key={t.title} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <h3 className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-900">{t.title}</h3>
                    <DataTable columns={t.columns} rows={t.rows} />
                  </section>
                ))}
              </div>
              <CapitalEntries entries={report.extra.entries} onChanged={(m) => { flash(m); load(); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClosingPanel({ report, day, onChanged }) {
  const [counted, setCounted] = useState(report.closed?.countedCash ?? "");
  const [note, setNote] = useState(report.closed?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCounted(report.closed?.countedCash ?? "");
    setNote(report.closed?.note ?? "");
  }, [report.closed, day]);

  const expected = report.extra.expectedCash;
  const diff = counted === "" ? null : Math.round((Number(counted) - expected) * 100) / 100;

  async function close() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reports/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, countedCash: counted, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not close the day.");
      onChanged("Day closed and saved.");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function reopen() {
    setBusy(true);
    try {
      await fetch(`/api/reports/closing?day=${day}`, { method: "DELETE" });
      onChanged("Day reopened.");
    } catch {
      setError("Could not reopen the day.");
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Close the day</h3>
        {report.closed && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Closed</span>}
      </div>
      <p className="mt-1 text-sm text-gray-500">Count the cash you have, and the app shows whether it matches what it expects: {formatNaira(expected)}.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="counted" className="mb-1 block text-xs text-gray-500">Cash counted (₦)</label>
          <input id="counted" type="number" min="0" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} className={`${inputClass} w-full`} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cnote" className="mb-1 block text-xs text-gray-500">Note (optional)</label>
          <input id="cnote" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} w-full`} />
        </div>
      </div>
      {diff !== null && (
        <p className={`mt-3 text-sm font-medium ${diff === 0 ? "text-green-700" : "text-amber-700"}`}>
          {diff === 0 ? "Cash matches." : diff > 0 ? `${formatNaira(diff)} more than expected.` : `${formatNaira(-diff)} short of what is expected.`}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={close} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {report.closed ? "Update closing" : "Close day"}
        </button>
        {report.closed && (
          <button type="button" onClick={reopen} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Reopen
          </button>
        )}
      </div>
    </section>
  );
}
