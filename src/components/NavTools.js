"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import GlobalSearch from "./GlobalSearch";

// Search button and notification bell shown in the header.
export default function NavTools({ shortcut = false }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shortcut) return;
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);

  // Refresh the badge whenever you move to another page.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setCount(d.count))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setOpen(true)} aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <Link href="/notifications" aria-label={count ? `${count} notifications` : "Notifications"} title="Notifications" className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          <Bell className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      </div>
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}
