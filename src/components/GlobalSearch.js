"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

// Search box that opens with Ctrl+K (or Cmd+K) or the search button.
export default function GlobalSearch({ open, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        setResults(json.results || []);
        setActive(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(item) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter") go(results[active]);
  }

  if (!open) return null;

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, customers, sales, suppliers"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-gray-400">Type at least 2 letters.</p>}
          {q.trim().length >= 2 && !loading && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">Nothing found for &ldquo;{q.trim()}&rdquo;.</p>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.id}>
                {header && <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-gray-400">{header}</p>}
                <button
                  type="button"
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full rounded-lg px-3 py-2 text-left ${i === active ? "bg-brand-50" : ""}`}
                >
                  <span className="block truncate text-sm font-medium text-gray-900">{r.title}</span>
                  <span className="block truncate text-xs text-gray-500">{r.text}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
