"use client";

import { useCallback, useEffect, useState } from "react";
import CapitalEntries from "./CapitalEntries";

export default function CapitalContent() {
  const [entries, setEntries] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cash-entries", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setEntries(json.entries || []);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Capital</h1>
        <p className="mt-1 text-sm text-gray-500">Extra money you invest in the business, and money you take out.</p>
      </div>
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {entries === null ? (
        <div className="h-32 animate-pulse rounded-xl bg-gray-200/70" />
      ) : (
        <CapitalEntries entries={entries} onChanged={(m) => { setNotice(m); setTimeout(() => setNotice(""), 3000); load(); }} />
      )}
    </div>
  );
}
