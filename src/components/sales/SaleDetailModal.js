"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";

const METHOD_LABELS = { cash: "Cash", transfer: "Bank Transfer", pos: "POS", card: "Card", other: "Other" };
const STATUS_LABELS = { paid: "Paid", partial: "Partially Paid", unpaid: "Unpaid" };
const SALE_STATUS_LABELS = { completed: "Completed", partially_refunded: "Partially refunded", refunded: "Refunded" };

function Row({ label, value, strong, tone }) {
  const toneClass = tone === "profit" ? "text-green-700" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={strong ? "font-medium text-gray-900" : "text-gray-500"}>{label}</span>
      <span className={`${strong ? "font-semibold" : "font-medium"} ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function SaleDetailModal({ saleId, orderNumber, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sales/${saleId}`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok) setError(d.error || "Could not load this sale.");
        else setData(d);
      })
      .catch(() => !cancelled && setError("Could not load this sale."));
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const sale = data?.sale;

  return (
    <Modal title={orderNumber} onClose={onClose} wide>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && !data && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {sale && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-400">Date</dt>
              <dd className="font-medium text-gray-900">{formatDate(sale.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Time</dt>
              <dd className="font-medium text-gray-900">{formatTime(sale.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Customer</dt>
              <dd className="font-medium text-gray-900">{sale.customerName}</dd>
              {sale.customerPhone && <dd className="text-xs text-gray-500">{sale.customerPhone}</dd>}
            </div>
            <div>
              <dt className="text-xs text-gray-400">Payment method</dt>
              <dd className="font-medium text-gray-900">{METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Payment status</dt>
              <dd className="font-medium text-gray-900">{STATUS_LABELS[sale.paymentStatus] || sale.paymentStatus}</dd>
            </div>
            {sale.status !== "completed" && (
              <div>
                <dt className="text-xs text-gray-400">Sale status</dt>
                <dd className="font-medium text-gray-900">{SALE_STATUS_LABELS[sale.status]}</dd>
              </div>
            )}
            {sale.dueDate && sale.balance > 0 && (
              <div>
                <dt className="text-xs text-gray-400">Due date</dt>
                <dd className="font-medium text-gray-900">{formatDate(sale.dueDate)}</dd>
              </div>
            )}
          </dl>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((i) => (
                  <tr key={i._id}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{i.productName}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {i.quantity}
                      {i.returnedQuantity > 0 && <span className="block text-xs text-red-500">{i.returnedQuantity} returned</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{formatNaira(i.costPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{formatNaira(i.sellingPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-700">{formatNaira(i.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4 py-2">
            <div className="py-1">
              <Row label="Subtotal" value={formatNaira(sale.subtotal)} />
              {sale.discount > 0 && <Row label="Discount" value={`- ${formatNaira(sale.discount)}`} />}
              {sale.deliveryFee > 0 && <Row label="Delivery fee" value={formatNaira(sale.deliveryFee)} />}
              {sale.otherCharges > 0 && <Row label="Other charges" value={formatNaira(sale.otherCharges)} />}
              <Row label="Total" value={formatNaira(sale.total)} strong />
            </div>
            <div className="py-1">
              <Row label="Cost of goods" value={formatNaira(sale.totalCost)} />
              <Row label="Gross profit" value={formatNaira(sale.profit)} strong tone={sale.profit < 0 ? "danger" : "profit"} />
              {sale.refundedRevenue > 0 && (
                <Row label="Profit given back (refunds)" value={`- ${formatNaira(sale.refundedProfit)}`} />
              )}
              {sale.refundedRevenue > 0 && (
                <Row label="Profit after refunds" value={formatNaira(sale.profit - sale.refundedProfit)} strong tone="profit" />
              )}
              {sale.packagingCost > 0 && <Row label="Bagging cost" value={`- ${formatNaira(sale.packagingCost)}`} />}
              {sale.packagingCost > 0 && (
                <Row
                  label="Profit after bagging"
                  value={formatNaira(sale.profit - sale.packagingCost)}
                  strong
                  tone={sale.profit - sale.packagingCost < 0 ? "danger" : "profit"}
                />
              )}
            </div>
            <div className="py-1">
              <Row label="Amount paid" value={formatNaira(sale.amountPaid)} />
              {sale.refundedAmount > 0 && <Row label="Cash refunded" value={`- ${formatNaira(sale.refundedAmount)}`} />}
              <Row label="Balance" value={formatNaira(sale.balance)} tone={sale.balance > 0 ? "danger" : undefined} />
            </div>
          </div>

          {data.refunds?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Refunds</h3>
              <ul className="divide-y divide-gray-100 text-sm">
                {data.refunds.map((r) => (
                  <li key={r._id} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">{formatDate(r.date)} · {formatTime(r.date)}</span>
                      <span className="font-medium text-gray-900">{formatNaira(r.revenue)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.items.map((i) => `${i.quantity} × ${i.productName}${i.restock ? "" : " (not restocked)"}`).join(", ")}
                      {r.cashRefunded > 0 ? ` · ${formatNaira(r.cashRefunded)} cash back` : " · no cash back"}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.payments.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Payments</h3>
              <ul className="divide-y divide-gray-100 text-sm">
                {data.payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between py-2">
                    <span className="text-gray-500">
                      {formatDate(p.date)} · {METHOD_LABELS[p.method] || p.method}
                      {p.type === "refund" ? " · refund" : p.source === "debt" ? " · debt payment" : ""}
                    </span>
                    <span className={`font-medium ${p.type === "refund" ? "text-red-600" : "text-gray-900"}`}>
                      {p.type === "refund" ? "- " : ""}{formatNaira(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
            {sale.status !== "refunded" && (
              <Link href={`/sales/${sale._id}/edit`} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Pencil className="h-4 w-4" /> Edit sale
              </Link>
            )}
            <Link href={`/receipt/${sale._id}`} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <FileText className="h-4 w-4" /> Receipt
            </Link>
          </div>

          {sale.notes && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">Notes</h3>
              <p className="text-sm text-gray-600">{sale.notes}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
