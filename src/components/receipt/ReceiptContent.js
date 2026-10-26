"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Printer, Share2 } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";

const METHODS = { cash: "Cash", transfer: "Bank Transfer", pos: "POS", card: "Card", other: "Other" };

function shareText(data) {
  const { sale, items, settings } = data;
  const lines = [
    `*${settings.businessName}*`,
    `Receipt ${sale.orderNumber}`,
    `${formatDate(sale.date)} ${formatTime(sale.date)}`,
    "",
    ...items.map((i) => `${i.quantity} x ${i.productName} - ${formatNaira(i.subtotal)}`),
    "",
    sale.discount > 0 ? `Discount: -${formatNaira(sale.discount)}` : null,
    sale.deliveryFee > 0 ? `Delivery: ${formatNaira(sale.deliveryFee)}` : null,
    `*Total: ${formatNaira(sale.total)}*`,
    `Paid: ${formatNaira(sale.amountPaid - (sale.refundedAmount || 0))}`,
    sale.balance > 0 ? `Balance: ${formatNaira(sale.balance)}` : null,
    "",
    settings.thankYouMessage,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

// Phone as a WhatsApp number: 0803... -> 234803...
function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export default function ReceiptContent({ saleId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/receipt/${saleId}`, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setData(d) : setError(d.error || "Could not load the receipt.")))
      .catch(() => setError("Could not load the receipt."));
  }, [saleId]);

  if (error) {
    return <div className="mx-auto max-w-md p-8 text-center text-sm text-red-600">{error}</div>;
  }
  if (!data) {
    return (
      <div className="flex justify-center p-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const { sale, items, refunds, settings } = data;
  const paid = sale.amountPaid - (sale.refundedAmount || 0);

  async function share() {
    const text = shareText(data);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${sale.orderNumber}`, text });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    const number = whatsappNumber(sale.customerPhone);
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-md flex-wrap items-center gap-2 print:hidden">
        <Link href="/sales" className="mr-auto inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Printer className="h-4 w-4" /> Print
        </button>
        <a href={`/api/receipt/${saleId}/pdf`} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" /> PDF
        </a>
        <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
        <div className="text-center">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="mx-auto mb-2 h-14 w-auto object-contain" />
          )}
          <h1 className="text-lg font-semibold text-gray-900">{settings.businessName}</h1>
          {settings.address && <p className="text-xs text-gray-500">{settings.address}</p>}
          {(settings.phone || settings.email) && (
            <p className="text-xs text-gray-500">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</p>
          )}
          {settings.taxName && settings.taxNumber && (
            <p className="text-xs text-gray-500">{settings.taxName}: {settings.taxNumber}</p>
          )}
        </div>

        <div className="my-4 border-t border-dashed border-gray-300" />

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Invoice no.</dt><dd className="font-medium text-gray-900">{sale.orderNumber}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd className="text-gray-900">{formatDate(sale.date)} · {formatTime(sale.date)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Customer</dt><dd className="text-gray-900">{sale.customerName}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Payment</dt><dd className="text-gray-900">{METHODS[sale.paymentMethod] || sale.paymentMethod}</dd></div>
        </dl>

        <div className="my-4 border-t border-dashed border-gray-300" />

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Price</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id} className="align-top">
                <td className="py-1 pr-2 text-gray-900">{i.productName}</td>
                <td className="py-1 text-right text-gray-700">{i.quantity}</td>
                <td className="py-1 text-right text-gray-700">{formatNaira(i.sellingPrice)}</td>
                <td className="py-1 text-right text-gray-900">{formatNaira(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-4 border-t border-dashed border-gray-300" />

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{formatNaira(sale.subtotal)}</dd></div>
          {sale.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd>- {formatNaira(sale.discount)}</dd></div>}
          {sale.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-gray-500">Delivery</dt><dd>{formatNaira(sale.deliveryFee)}</dd></div>}
          {sale.otherCharges > 0 && <div className="flex justify-between"><dt className="text-gray-500">Other charges</dt><dd>{formatNaira(sale.otherCharges)}</dd></div>}
          <div className="flex justify-between text-base font-semibold text-gray-900"><dt>Total</dt><dd>{formatNaira(sale.total)}</dd></div>
          {sale.refundedRevenue > 0 && <div className="flex justify-between"><dt className="text-gray-500">Refunded</dt><dd>- {formatNaira(sale.refundedRevenue)}</dd></div>}
          <div className="flex justify-between"><dt className="text-gray-500">Paid</dt><dd>{formatNaira(paid)}</dd></div>
          <div className={`flex justify-between font-semibold ${sale.balance > 0 ? "text-red-600" : "text-gray-900"}`}><dt>Balance</dt><dd>{formatNaira(sale.balance)}</dd></div>
        </dl>

        {refunds.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">This sale has {refunds.length} refund{refunds.length === 1 ? "" : "s"}.</p>
        )}

        <div className="my-4 border-t border-dashed border-gray-300" />
        <p className="text-center text-sm text-gray-700">{settings.thankYouMessage}</p>
        {settings.invoiceFooter && <p className="mt-1 text-center text-xs text-gray-400">{settings.invoiceFooter}</p>}
      </div>
    </div>
  );
}
