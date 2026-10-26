"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

const METHODS = [
  ["cash", "Cash"], ["transfer", "Bank Transfer"], ["pos", "POS"], ["card", "Card"], ["other", "Other"],
];

export default function SettingsContent() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setForm(d.settings) : setError(d.error || "Could not load settings.")))
      .catch(() => setError("Could not load settings."));
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setVal = (field) => (v) => setForm((f) => ({ ...f, [field]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save.");
      setForm(json.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  if (!form) {
    return error ? (
      <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>
    ) : (
      <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200/70" />)}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Your business details, sale defaults and backups.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="businessName"><input id="businessName" required value={form.businessName} onChange={set("businessName")} className={inputClass} /></Field>
            <Field label="Logo link" htmlFor="logoUrl" hint="A web address of your logo image (https://...). Shown on receipts."><input id="logoUrl" value={form.logoUrl} onChange={set("logoUrl")} className={inputClass} placeholder="https://..." /></Field>
            <Field label="Phone" htmlFor="phone"><input id="phone" type="tel" value={form.phone} onChange={set("phone")} className={inputClass} /></Field>
            <Field label="Email" htmlFor="email"><input id="email" type="email" value={form.email} onChange={set("email")} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Address" htmlFor="address"><textarea id="address" rows={2} value={form.address} onChange={set("address")} className={inputClass} /></Field></div>
            <Field label="Tax name (optional)" htmlFor="taxName" hint="Shown on receipts only, e.g. VAT. Tax is not added to your sales."><input id="taxName" value={form.taxName} onChange={set("taxName")} className={inputClass} /></Field>
            <Field label="Tax number (optional)" htmlFor="taxNumber"><input id="taxNumber" value={form.taxNumber} onChange={set("taxNumber")} className={inputClass} /></Field>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Sales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency" hint="The app works in Nigerian Naira (₦)."><input id="currency" disabled value="Nigerian Naira (₦)" className={`${inputClass} bg-gray-50 text-gray-500`} /></Field>
            <Field label="Default payment method" htmlFor="defaultPaymentMethod">
              <select id="defaultPaymentMethod" value={form.defaultPaymentMethod} onChange={set("defaultPaymentMethod")} className={inputClass}>
                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Default discount (₦)" htmlFor="defaultDiscount" hint="Filled in on every new sale. Leave 0 for none."><input id="defaultDiscount" type="number" min="0" step="any" value={form.defaultDiscount} onChange={set("defaultDiscount")} className={inputClass} /></Field>
            <Field label="Large expense alert (₦)" htmlFor="largeExpenseThreshold" hint="You get a notification for expenses at or above this amount."><input id="largeExpenseThreshold" type="number" min="0" step="any" value={form.largeExpenseThreshold} onChange={set("largeExpenseThreshold")} className={inputClass} /></Field>
            <div className="space-y-3 sm:col-span-2">
              <Toggle id="autoStock" checked={form.autoStockDeduction} onChange={setVal("autoStockDeduction")} label="Take items out of stock automatically" hint="When off, selling does not change your stock numbers." />
              <Toggle id="negStock" checked={form.allowNegativeStock} onChange={setVal("allowNegativeStock")} label="Allow selling more than is in stock" hint="Stock can go below zero. Keep this off to be stopped when stock runs out." />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Receipts</h2>
          <div className="grid gap-4">
            <Field label="Thank-you message" htmlFor="thankYouMessage"><input id="thankYouMessage" value={form.thankYouMessage} onChange={set("thankYouMessage")} className={inputClass} /></Field>
            <Field label="Footer (optional)" htmlFor="invoiceFooter" hint="e.g. return policy or bank details"><textarea id="invoiceFooter" rows={2} value={form.invoiceFooter} onChange={set("invoiceFooter")} className={inputClass} /></Field>
          </div>
        </section>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </button>
          {saved && <span className="inline-flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </form>

      <DataSection />
    </div>
  );
}

function DataSection() {
  const [file, setFile] = useState(null);
  const [backup, setBackup] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  async function pick(e) {
    const f = e.target.files?.[0];
    setMessage(null);
    setBackup(null);
    setFile(f || null);
    if (!f) return;
    try {
      setBackup(JSON.parse(await f.text()));
    } catch {
      setMessage({ ok: false, text: "That file could not be read as a backup." });
    }
  }

  async function restore() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, backup }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The restore failed.");
      setMessage({ ok: true, text: "Backup restored. Reload the page to see your data." });
      setFile(null);
      setBackup(null);
      setConfirm("");
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
    setBusy(false);
  }

  const linkClass = "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Export your data</h2>
        <p className="mt-1 text-sm text-gray-500">Everything, from the start, as spreadsheets.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a className={linkClass} href="/api/export/sales?format=xlsx"><Download className="h-4 w-4" /> All sales</a>
          <a className={linkClass} href="/api/export/customers?format=xlsx&from=2000-01-01"><Download className="h-4 w-4" /> Customers</a>
          <a className={linkClass} href="/api/export/products?format=xlsx&from=2000-01-01"><Download className="h-4 w-4" /> Products</a>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-sm font-semibold text-gray-900">Backup</h2>
        <p className="mt-1 text-sm text-gray-500">A complete copy of your sales, stock, expenses, customers and settings. Keep it somewhere safe.</p>
        <a className={`${linkClass} mt-3`} href="/api/backup"><Download className="h-4 w-4" /> Download backup</a>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-sm font-semibold text-gray-900">Restore from a backup</h2>
        <p className="mt-1 text-sm text-red-600">This replaces everything you have now with the contents of the backup file. Your login is not affected.</p>
        <div className="mt-3 space-y-3">
          <label className={`${linkClass} cursor-pointer`}>
            <Upload className="h-4 w-4" /> {file ? file.name : "Choose backup file"}
            <input type="file" accept="application/json,.json" onChange={pick} className="sr-only" />
          </label>
          {backup && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="restoreConfirm" className="mb-1 block text-xs text-gray-500">Type RESTORE to confirm</label>
                <input id="restoreConfirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
              </div>
              <button type="button" onClick={restore} disabled={busy || confirm !== "RESTORE"} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Restore now
              </button>
            </div>
          )}
          {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
        </div>
      </div>
    </section>
  );
}
