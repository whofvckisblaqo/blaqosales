"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BellOff, CheckCircle2, Info, PackageX } from "lucide-react";

const STYLES = {
  danger: { icon: PackageX, box: "bg-red-50 text-red-600" },
  warning: { icon: AlertTriangle, box: "bg-amber-50 text-amber-600" },
  info: { icon: Info, box: "bg-blue-50 text-blue-600" },
  success: { icon: CheckCircle2, box: "bg-green-50 text-green-600" },
};

export default function NotificationsContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setData(d) : setError(d.error || "Could not load notifications.")))
      .catch(() => setError("Could not load notifications."));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">Things that need your attention. This list updates itself as you fix them.</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />)}</div>}

      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><BellOff className="h-6 w-6" /></div>
          <p className="text-sm font-medium text-gray-900">All clear</p>
          <p className="mt-1 text-sm text-gray-500">Nothing needs your attention right now.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((n) => {
            const s = STYLES[n.level] || STYLES.info;
            const Icon = s.icon;
            return (
              <li key={n.id}>
                <Link href={n.href} className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-300">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.box}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                    <span className="block text-sm text-gray-500">{n.text}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
