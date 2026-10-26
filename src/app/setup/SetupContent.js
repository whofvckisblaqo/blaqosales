"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function SetupContent() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", businessName: "Blaqo Scents", password: "", setupKey: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (f) => (e) => setForm((x) => ({ ...x, [f]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not create the account.");
        setLoading(false);
        return;
      }
      router.replace("/login");
    } catch {
      setError("Network problem. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">This page works once. After your account exists it disappears.</p>
        </div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">Your name</label>
          <input id="name" required value={form.name} onChange={set("name")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
          <input id="email" type="email" required value={form.email} onChange={set("email")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="businessName" className="mb-1.5 block text-sm font-medium text-gray-700">Business name</label>
          <input id="businessName" value={form.businessName} onChange={set("businessName")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password (8 or more characters)</label>
          <input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="setupKey" className="mb-1.5 block text-sm font-medium text-gray-700">Setup key</label>
          <input id="setupKey" type="password" required value={form.setupKey} onChange={set("setupKey")} className={inputClass} />
          <p className="mt-1 text-xs text-gray-400">Use the AUTH_SECRET value you saved in Vercel.</p>
        </div>
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>
    </div>
  );
}
