"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/money";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const today = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10);

// Money put in from outside the business, or taken out by the owner.
export default function CapitalEntries({ entries, onChanged }) {
  const [type, setType] = useState("income");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cash-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, amount, date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save.");
      setName("");
      setAmount("");
      onChanged("Entry added.");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function remove(id) {
    await fetch(`/api/cash-entries/${id}`, { method: "DELETE" });
    onChanged("Entry removed.");
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Other money in or out</h3>
      <p className="mt-1 text-sm text-gray-500">
        Money you put in from outside the business, or money you take out for yourself. It is not a sale or an expense, so it does not change your profit.
      </p>
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_150px_160px_auto]">
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="income">Money in</option>
          <option value="withdrawal">Owner withdrawal</option>
        </select>
        <input aria-label="What for" required placeholder="What is it for?" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <input aria-label="Date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <input aria-label="Amount" required type="number" min="0" step="any" placeholder="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {entries.map((e) => (
            <li key={e._id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-gray-600">{e.date} · {e.type === "income" ? "In" : "Out"} · {e.name}</span>
              <span className="flex items-center gap-2">
                <span className={`font-medium ${e.type === "income" ? "text-green-700" : "text-gray-900"}`}>{formatNaira(e.amount)}</span>
                <button type="button" aria-label="Remove entry" onClick={() => remove(e._id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
