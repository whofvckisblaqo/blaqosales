"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Plus, Search, Truck } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import SupplierFormModal from "./SupplierFormModal";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function SuppliersContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debounced, setDebounced] = useState(search.trim());
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/suppliers${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load suppliers.");
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message);
      setData((d) => d ?? { suppliers: [], totalOwing: 0 });
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500">Who you buy from, and what you owe them.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add supplier
        </button>
      </div>

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {data && data.suppliers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs text-gray-500">Suppliers</p><p className="mt-0.5 text-lg font-semibold text-gray-900">{data.suppliers.length}</p></div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs text-gray-500">You owe</p><p className={`mt-0.5 text-lg font-semibold ${data.totalOwing > 0 ? "text-red-600" : "text-gray-900"}`}>{formatNaira(data.totalOwing)}</p></div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers" className={`${inputClass} pl-10`} />
      </div>

      {data === null && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />)}</div>}

      {data && data.suppliers.length === 0 && !error && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Truck className="h-6 w-6" /></div>
          <p className="text-sm font-medium text-gray-900">{debounced ? "No suppliers match your search" : "No suppliers yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">Add a supplier, then pick them when you receive stock.</p>
        </div>
      )}

      {data && data.suppliers.length > 0 && (
        <div className="space-y-3">
          {data.suppliers.map((s) => (
            <Link key={s._id} href={`/suppliers/${s._id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{s.name}</p>
                  <p className="truncate text-xs text-gray-500">{[s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                </div>
                {s.owing > 0 && <span className="whitespace-nowrap rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Owing</span>}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-gray-400">Purchased</dt><dd className="font-medium text-gray-900">{formatNaira(s.purchased)}</dd></div>
                <div><dt className="text-xs text-gray-400">Paid</dt><dd className="text-gray-700">{formatNaira(s.paid)}</dd></div>
                <div><dt className="text-xs text-gray-400">You owe</dt><dd className={`font-medium ${s.owing > 0 ? "text-red-600" : "text-gray-900"}`}>{formatNaira(s.owing)}</dd></div>
              </dl>
              {s.lastDelivery && <p className="mt-2 text-xs text-gray-400">Last delivery {formatDate(s.lastDelivery)}</p>}
            </Link>
          ))}
        </div>
      )}

      <AnimatePresence>
        {adding && (
          <SupplierFormModal
            key="add"
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              setNotice("Supplier added.");
              setTimeout(() => setNotice(""), 3000);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
