"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { History, PackagePlus, Pencil, Plus, Search, Trash2, Package, AlertTriangle } from "lucide-react";
import { formatNaira } from "@/lib/money";
import ProductFormModal from "./ProductFormModal";
import StockModal from "./StockModal";
import HistoryModal from "./HistoryModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const STATUS_STYLES = {
  in_stock: { label: "In stock", className: "bg-green-50 text-green-700" },
  low_stock: { label: "Low stock", className: "bg-amber-50 text-amber-700" },
  out_of_stock: { label: "Out of stock", className: "bg-red-50 text-red-700" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.in_stock;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

function Thumb({ product }) {
  if (product.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
      <Package className="h-5 w-5" />
    </div>
  );
}

function ActionButtons({ product, onEdit, onStock, onHistory, onDelete }) {
  const base = "rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900";
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="Adjust stock" aria-label="Adjust stock" onClick={() => onStock(product)} className={base}>
        <PackagePlus className="h-4 w-4" />
      </button>
      <button type="button" title="Stock history" aria-label="Stock history" onClick={() => onHistory(product)} className={base}>
        <History className="h-4 w-4" />
      </button>
      <button type="button" title="Edit" aria-label="Edit product" onClick={() => onEdit(product)} className={base}>
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" title="Delete" aria-label="Delete product" onClick={() => onDelete(product)} className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ProductsContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(null); // { type, product }
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  // Opened from the global search: /products?q=Club
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/products?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load products.");
      setProducts(data.products);
    } catch (err) {
      setError(err.message || "Could not load products.");
      setProducts((p) => p ?? []);
    }
  }, [debounced, status]);

  useEffect(() => {
    load();
  }, [load]);

  function closeModal() {
    setModal(null);
  }

  function saved(message) {
    closeModal();
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
    load();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${modal.product._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the product.");
      setDeleting(false);
      saved(data.archived ? "Product archived (it has past sales)." : "Product deleted.");
    } catch (err) {
      setDeleting(false);
      closeModal();
      setError(err.message);
    }
  }

  const loading = products === null;
  const isFiltering = Boolean(debounced) || status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">Your inventory, prices and stock levels.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products/receive"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <PackagePlus className="h-4 w-4" />
            Receive Stock
          </Link>
          <button
            type="button"
            onClick={() => setModal({ type: "form", product: null })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-medium underline">Try again</button>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, brand, SKU or category"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                status === f.value
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200/70" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && products.length === 0 && !error && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Package className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {isFiltering ? "No products match your search" : "No products yet"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {isFiltering
              ? "Try a different search or filter."
              : "Add your first product with its cost and selling price to start tracking stock and profit."}
          </p>
          {!isFiltering && (
            <button
              type="button"
              onClick={() => setModal({ type: "form", product: null })}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          )}
        </div>
      )}

      {/* Desktop table */}
      {!loading && products.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 text-right font-medium">Cost</th>
                <th className="px-3 py-3 text-right font-medium">Stock</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb product={p} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{p.label}</p>
                        <p className="truncate text-xs text-gray-500">{[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{p.category}</td>
                  <td className="px-3 py-3 text-right text-gray-600">{formatNaira(p.costPrice)}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">{p.stock}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.stockStatus} /></td>
                  <td className="px-5 py-3">
                    <ActionButtons
                      product={p}
                      onEdit={(x) => setModal({ type: "form", product: x })}
                      onStock={(x) => setModal({ type: "stock", product: x })}
                      onHistory={(x) => setModal({ type: "history", product: x })}
                      onDelete={(x) => setModal({ type: "delete", product: x })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && products.length > 0 && (
        <div className="space-y-3 md:hidden">
          {products.map((p) => (
            <div key={p._id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <Thumb product={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{p.label}</p>
                  <p className="truncate text-xs text-gray-500">{[p.brand, p.category].filter(Boolean).join(" · ")}</p>
                </div>
                <StatusBadge status={p.stockStatus} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Cost</dt>
                  <dd className="text-gray-700">{formatNaira(p.costPrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Stock</dt>
                  <dd className="font-medium text-gray-900">{p.stock}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-end border-t border-gray-100 pt-3">
                <ActionButtons
                  product={p}
                  onEdit={(x) => setModal({ type: "form", product: x })}
                  onStock={(x) => setModal({ type: "stock", product: x })}
                  onHistory={(x) => setModal({ type: "history", product: x })}
                  onDelete={(x) => setModal({ type: "delete", product: x })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal?.type === "form" && (
          <ProductFormModal
            key="form"
            product={modal.product}
            onClose={closeModal}
            onSaved={() => saved(modal.product ? "Product updated." : "Product added.")}
          />
        )}
        {modal?.type === "stock" && (
          <StockModal key="stock" product={modal.product} onClose={closeModal} onSaved={() => saved("Stock updated.")} />
        )}
        {modal?.type === "history" && <HistoryModal key="history" product={modal.product} onClose={closeModal} />}
        {modal?.type === "delete" && (
          <ConfirmDialog
            key="delete"
            title="Delete product?"
            message={`"${modal.product.label}" will be removed. If it has past sales it is archived instead, so your sales records and reports stay correct.`}
            confirmLabel="Delete"
            danger
            loading={deleting}
            onConfirm={confirmDelete}
            onCancel={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
