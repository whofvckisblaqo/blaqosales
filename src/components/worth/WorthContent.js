"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

function Line({ label, hint, value, sign, strong, tone }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "profit" ? "text-green-700" : "text-gray-900";
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className={strong ? "font-semibold text-gray-900" : "text-sm text-gray-700"}>{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <p className={`whitespace-nowrap ${strong ? "text-lg font-semibold" : "text-sm font-medium"} ${toneClass}`}>
        {sign}{formatNaira(Math.abs(value))}
      </p>
    </div>
  );
}

export default function WorthContent() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/worth", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load this page.");
      setD(json);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function start() {
    setBusy(true);
    try {
      await fetch("/api/worth/start", { method: "POST" });
      setConfirming(false);
      await load();
    } catch {
      setError("Could not start recording.");
    }
    setBusy(false);
  }

  if (error && !d) return <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>;
  if (!d) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200/70" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Business Worth</h1>
        <p className="mt-1 text-sm text-gray-500">What the business has in total, kept up to date after every sale, purchase and expense.</p>
      </div>

      {!d.started ? (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Start recording</h2>
          <p className="mt-1 text-sm text-gray-600">
            Load all the products you have in store first. Your goods in store are worth <strong>{formatNaira(d.stock.value)}</strong> at cost
            ({d.stock.units} items, {d.stock.products} products). When everything is loaded, press the button below. That day becomes your starting point.
          </p>
          <p className="mt-2 text-sm text-gray-600">Delete any test sales or test entries first, so your records start clean.</p>
          <button type="button" onClick={() => setConfirming(true)} className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Start recording from today
          </button>
        </section>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs text-gray-500">Business worth now</p><p className="mt-0.5 text-xl font-semibold text-gray-900">{formatNaira(d.worth)}</p></div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs text-gray-500">Started with</p><p className="mt-0.5 text-xl font-semibold text-gray-900">{formatNaira(d.startingWorth)}</p><p className="text-xs text-gray-400">on {formatDate(d.startedAt)}</p></div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs text-gray-500">Growth since then</p><p className={`mt-0.5 text-xl font-semibold ${d.growth < 0 ? "text-red-600" : "text-green-700"}`}>{d.growth < 0 ? "-" : "+"}{formatNaira(Math.abs(d.growth))}</p><p className="text-xs text-gray-400">not counting money you added or took out</p></div>
          </div>

          <section className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-5">
            <Line label="Goods in store" hint={`${d.stock.units} items at cost price`} value={d.stock.value} sign="" />
            <Line label="Cash and bank" hint={`${formatNaira(d.moneyIn)} in, ${formatNaira(d.moneyOut)} out since you started`} value={d.cash} sign={d.cash < 0 ? "-" : ""} tone={d.cash < 0 ? "danger" : undefined} />
            <Line label="Customers owe you" value={d.owedToYou} sign="+" />
            <Line label="You owe suppliers" value={d.owedToSuppliers} sign="-" />
            <Line label="Business worth" value={d.worth} sign="" strong />
          </section>

          {d.cash < 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Cash and bank is below zero because you have paid for goods or expenses without recording money coming in. If you paid with your own money, add it as Money in on the Capital page.
            </p>
          )}

          <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-gray-500 underline hover:text-gray-900">Start again from today</button>
        </>
      )}

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            key="c"
            title={d.started ? "Start again from today?" : "Start recording from today?"}
            message={`Your starting point will be the goods in store now: ${formatNaira(d.stock.value)}. Cash is counted from today onward.`}
            confirmLabel="Start"
            loading={busy}
            onConfirm={start}
            onCancel={() => setConfirming(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
