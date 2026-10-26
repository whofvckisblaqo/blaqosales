"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, HandCoins, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SaleDetailModal from "@/components/sales/SaleDetailModal";
import CustomerFormModal from "./CustomerFormModal";
import RecordPaymentModal from "./RecordPaymentModal";
import SaleStatusBadge from "./SaleStatusBadge";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Pager({ data, setPage }) {
  if (!data || data.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">Page {data.page} of {data.pages}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> Previous</button>
        <button type="button" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={data.page >= data.pages} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next <ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{text}</p>
      {action}
    </div>
  );
}

function Skeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/70" />)}
    </div>
  );
}

export default function CustomersContent() {
  const searchParams = useSearchParams();

  const [tab, setTab] = useState("customers");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // form | delete | pay | view

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  // ---- customers tab ----
  const [cData, setCData] = useState(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("name");
  const [cPage, setCPage] = useState(1);
  const [deleting, setDeleting] = useState(false);

  // ---- owing tab ----
  const [dData, setDData] = useState(null);
  const [dSearch, setDSearch] = useState("");
  const [dDebounced, setDDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [dPage, setDPage] = useState(1);

  useEffect(() => {
    if (searchParams.get("add") === "1") setModal({ type: "form", customer: null });
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDDebounced(dSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [dSearch]);

  useEffect(() => setCPage(1), [debounced, sort]);
  useEffect(() => setDPage(1), [dDebounced, status]);

  const loadCustomers = useCallback(async () => {
    try {
      const p = new URLSearchParams({ sort, page: String(cPage) });
      if (debounced) p.set("q", debounced);
      const res = await fetch(`/api/customers?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load customers.");
      setCData(json);
      setError("");
    } catch (err) {
      setError(err.message);
      setCData((d) => d ?? { customers: [], count: 0, page: 1, pages: 1, owingCustomers: 0 });
    }
  }, [debounced, sort, cPage]);

  const loadDebts = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(dPage) });
      if (dDebounced) p.set("q", dDebounced);
      if (status) p.set("status", status);
      const res = await fetch(`/api/debts?${p}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load outstanding payments.");
      setDData(json);
      setError("");
    } catch (err) {
      setError(err.message);
      setDData((d) => d ?? { sales: [], count: 0, page: 1, pages: 1, summary: { totalOwed: 0, orders: 0, overdueOwed: 0, overdueOrders: 0 } });
    }
  }, [dDebounced, status, dPage]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadDebts(); }, [loadDebts]);

  function reloadAll() {
    loadCustomers();
    loadDebts();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${modal.customer._id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not delete the customer.");
      setDeleting(false);
      setModal(null);
      flash("Customer deleted.");
      reloadAll();
    } catch (err) {
      setDeleting(false);
      setModal(null);
      setError(err.message);
    }
  }

  const addButton = (
    <button type="button" onClick={() => setModal({ type: "form", customer: null })} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 sm:self-auto">
      <Plus className="h-4 w-4" /> Add Customer
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Your customers and the money they owe you.</p>
        </div>
        {addButton}
      </div>

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={reloadAll} className="font-medium underline">Try again</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 sm:w-fit">
        {[
          { value: "customers", label: "All customers" },
          { value: "owing", label: `Outstanding payments${dData?.summary.orders ? ` (${dData.summary.orders})` : ""}` },
        ].map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)} className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- Customers ---------- */}
      {tab === "customers" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or email" className={`${inputClass} pl-10`} />
            </div>
            <select aria-label="Sort customers" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} sm:w-52`}>
              <option value="name">Name (A to Z)</option>
              <option value="spent">Spent the most</option>
              <option value="owes">Owes the most</option>
              <option value="recent">Latest purchase</option>
            </select>
          </div>

          {!cData && <Skeletons />}

          {cData && cData.customers.length === 0 && !error && (
            <Empty
              icon={Users}
              title={debounced ? "No customers match your search" : "No customers yet"}
              text={debounced ? "Try a different name or number." : "Customers are added automatically when you record a sale with a name, or you can add one yourself."}
              action={!debounced && <div className="mt-5">{addButton}</div>}
            />
          )}

          {cData && cData.customers.length > 0 && (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 text-right font-medium">Orders</th>
                      <th className="px-3 py-3 text-right font-medium">Total spent</th>
                      <th className="px-3 py-3 text-right font-medium">Owes</th>
                      <th className="px-3 py-3 font-medium">Last purchase</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cData.customers.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3">
                          <Link href={`/customers/${c._id}`} className="font-medium text-gray-900 hover:text-brand-700">{c.name}</Link>
                          <p className="text-xs text-gray-500">{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700">{c.orders}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900">{formatNaira(c.spent)}</td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right font-medium ${c.balance > 0 ? "text-red-600" : "text-gray-400"}`}>{c.balance > 0 ? formatNaira(c.balance) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600">{c.lastPurchase ? formatDate(c.lastPurchase) : "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Link href={`/customers/${c._id}`} title="View profile" aria-label="View profile" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Eye className="h-4 w-4" /></Link>
                            <button type="button" title="Edit" aria-label="Edit customer" onClick={() => setModal({ type: "form", customer: c })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Pencil className="h-4 w-4" /></button>
                            <button type="button" title="Delete" aria-label="Delete customer" onClick={() => setModal({ type: "delete", customer: c })} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {cData.customers.map((c) => (
                  <div key={c._id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <Link href={`/customers/${c._id}`} className="font-medium text-gray-900">{c.name}</Link>
                    <p className="text-xs text-gray-500">{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-xs text-gray-400">Orders</dt><dd className="font-medium text-gray-900">{c.orders}</dd></div>
                      <div><dt className="text-xs text-gray-400">Spent</dt><dd className="font-medium text-gray-900">{formatNaira(c.spent)}</dd></div>
                      <div><dt className="text-xs text-gray-400">Owes</dt><dd className={`font-medium ${c.balance > 0 ? "text-red-600" : "text-gray-400"}`}>{c.balance > 0 ? formatNaira(c.balance) : "—"}</dd></div>
                    </dl>
                    <div className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-3">
                      <Link href={`/customers/${c._id}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"><Eye className="h-4 w-4" /> View</Link>
                      <button type="button" onClick={() => setModal({ type: "form", customer: c })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"><Pencil className="h-4 w-4" /> Edit</button>
                      <button type="button" onClick={() => setModal({ type: "delete", customer: c })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pager data={cData} setPage={setCPage} />
            </>
          )}
        </>
      )}

      {/* ---------- Outstanding payments ---------- */}
      {tab === "owing" && (
        <>
          {dData && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Total owed to you</p>
                <p className="mt-2 text-2xl font-semibold text-red-600">{formatNaira(dData.summary.totalOwed)}</p>
                <p className="mt-1 text-xs text-gray-400">{dData.summary.orders} order{dData.summary.orders === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNaira(dData.summary.overdueOwed)}</p>
                <p className="mt-1 text-xs text-gray-400">{dData.summary.overdueOrders} past the due date</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Customers owing</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{cData?.owingCustomers ?? "—"}</p>
                <p className="mt-1 text-xs text-gray-400">With a balance to pay</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="search" value={dSearch} onChange={(e) => setDSearch(e.target.value)} placeholder="Search customer, phone or order ID" className={`${inputClass} pl-10`} />
            </div>
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} sm:w-52`}>
              <option value="">All outstanding</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {!dData && <Skeletons />}

          {dData && dData.sales.length === 0 && !error && (
            <Empty
              icon={HandCoins}
              title={dDebounced || status ? "Nothing matches your filters" : "Nobody owes you anything"}
              text={dDebounced || status ? "Try changing or clearing the filters." : "When a sale is unpaid or part-paid, it will show here until it is settled."}
            />
          )}

          {dData && dData.sales.length > 0 && (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Order ID</th>
                      <th className="px-3 py-3 text-right font-medium">Total</th>
                      <th className="px-3 py-3 text-right font-medium">Paid</th>
                      <th className="px-3 py-3 text-right font-medium">Balance</th>
                      <th className="px-3 py-3 font-medium">Due date</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dData.sales.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3">
                          {s.customer ? <Link href={`/customers/${s.customer}`} className="font-medium text-gray-900 hover:text-brand-700">{s.customerName}</Link> : <span className="font-medium text-gray-900">{s.customerName}</span>}
                          {s.customerPhone && <p className="text-xs text-gray-500">{s.customerPhone}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">{s.orderNumber}<span className="block text-xs text-gray-400">{formatDate(s.date)}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">{formatNaira(s.total)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">{formatNaira(s.amountPaid)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-red-600">{formatNaira(s.balance)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600">{s.dueDate ? formatDate(s.dueDate) : "—"}</td>
                        <td className="px-3 py-3"><SaleStatusBadge sale={s} /></td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" title="View sale" aria-label="View sale" onClick={() => setModal({ type: "view", sale: s })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><Eye className="h-4 w-4" /></button>
                            <button type="button" onClick={() => setModal({ type: "pay", sale: s })} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"><HandCoins className="h-3.5 w-3.5" /> Record payment</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {dData.sales.map((s) => (
                  <div key={s._id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{s.customerName}</p>
                        <p className="text-xs text-gray-500">{s.orderNumber} · {formatDate(s.date)}</p>
                      </div>
                      <SaleStatusBadge sale={s} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-xs text-gray-400">Total</dt><dd className="text-gray-900">{formatNaira(s.total)}</dd></div>
                      <div><dt className="text-xs text-gray-400">Paid</dt><dd className="text-gray-900">{formatNaira(s.amountPaid)}</dd></div>
                      <div><dt className="text-xs text-gray-400">Owes</dt><dd className="font-semibold text-red-600">{formatNaira(s.balance)}</dd></div>
                    </dl>
                    {s.dueDate && <p className="mt-2 text-xs text-gray-500">Due {formatDate(s.dueDate)}</p>}
                    <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                      <button type="button" onClick={() => setModal({ type: "view", sale: s })} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">View</button>
                      <button type="button" onClick={() => setModal({ type: "pay", sale: s })} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"><HandCoins className="h-4 w-4" /> Record payment</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pager data={dData} setPage={setDPage} />
            </>
          )}
        </>
      )}

      <AnimatePresence>
        {modal?.type === "form" && (
          <CustomerFormModal key="form" customer={modal.customer} onClose={() => setModal(null)} onSaved={() => { setModal(null); flash(modal.customer ? "Customer updated." : "Customer added."); reloadAll(); }} />
        )}
        {modal?.type === "pay" && (
          <RecordPaymentModal key="pay" sale={modal.sale} onClose={() => setModal(null)} onSaved={(msg) => { setModal(null); flash(msg); reloadAll(); }} />
        )}
        {modal?.type === "view" && (
          <SaleDetailModal key="view" saleId={modal.sale._id} orderNumber={modal.sale.orderNumber} onClose={() => setModal(null)} />
        )}
        {modal?.type === "delete" && (
          <ConfirmDialog key="delete" title="Delete customer?" message={`"${modal.customer.name}" will be removed. Customers with orders on record can't be deleted.`} confirmLabel="Delete" danger loading={deleting} onConfirm={confirmDelete} onCancel={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
