import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { loadReceipt } from "@/lib/receiptData";
import { renderPdf } from "@/lib/pdfKit";
import { formatNGN } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";

const METHODS = { cash: "Cash", transfer: "Bank Transfer", pos: "POS", card: "Card", other: "Other" };

export async function GET(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  await connectDB();
  const data = await loadReceipt(id);
  if (!data) return fail("Sale not found.", 404);
  const { sale, items, settings } = data;

  const pdf = await renderPdf(
    (doc) => {
      const W = doc.page.width - 80;
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(settings.businessName, { align: "center" });
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
      for (const l of [settings.address, settings.phone, settings.email]) if (l) doc.text(l, { align: "center" });
      if (settings.taxName && settings.taxNumber) doc.text(`${settings.taxName}: ${settings.taxNumber}`, { align: "center" });
      doc.moveDown(0.8);

      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("RECEIPT", { align: "center" });
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Invoice no: ${sale.orderNumber}`);
      doc.text(`Date: ${formatDate(sale.date)}  ${formatTime(sale.date)}`);
      doc.text(`Customer: ${sale.customerName}${sale.customerPhone ? ` (${sale.customerPhone})` : ""}`);
      doc.moveDown(0.8);

      // Items
      const cols = [W * 0.46, W * 0.1, W * 0.22, W * 0.22];
      let y = doc.y;
      doc.rect(40, y, W, 18).fill("#f3f4f6");
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9);
      doc.text("Item", 44, y + 5, { width: cols[0] });
      doc.text("Qty", 40 + cols[0], y + 5, { width: cols[1], align: "right" });
      doc.text("Price", 40 + cols[0] + cols[1], y + 5, { width: cols[2], align: "right" });
      doc.text("Amount", 40 + cols[0] + cols[1] + cols[2], y + 5, { width: cols[3] - 4, align: "right" });
      y += 22;
      doc.font("Helvetica").fontSize(9);
      for (const i of items) {
        const h = Math.max(doc.heightOfString(i.productName, { width: cols[0] - 4 }), 12);
        doc.text(i.productName, 44, y, { width: cols[0] - 4 });
        doc.text(String(i.quantity), 40 + cols[0], y, { width: cols[1], align: "right" });
        doc.text(formatNGN(i.sellingPrice), 40 + cols[0] + cols[1], y, { width: cols[2], align: "right" });
        doc.text(formatNGN(i.subtotal), 40 + cols[0] + cols[1] + cols[2], y, { width: cols[3] - 4, align: "right" });
        y += h + 6;
      }
      doc.moveTo(40, y).lineTo(40 + W, y).strokeColor("#d1d5db").stroke();
      y += 10;

      function totalLine(label, value, bold) {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10).fillColor("#111827");
        doc.text(label, 40 + W * 0.5, y, { width: W * 0.25 });
        doc.text(value, 40 + W * 0.75, y, { width: W * 0.25 - 4, align: "right" });
        y += bold ? 18 : 15;
      }
      totalLine("Subtotal", formatNGN(sale.subtotal));
      if (sale.discount > 0) totalLine("Discount", `- ${formatNGN(sale.discount)}`);
      if (sale.deliveryFee > 0) totalLine("Delivery", formatNGN(sale.deliveryFee));
      if (sale.otherCharges > 0) totalLine("Other charges", formatNGN(sale.otherCharges));
      totalLine("Total", formatNGN(sale.total), true);
      if (sale.refundedRevenue > 0) totalLine("Refunded", `- ${formatNGN(sale.refundedRevenue)}`);
      totalLine("Paid", formatNGN(sale.amountPaid - (sale.refundedAmount || 0)));
      totalLine("Balance", formatNGN(sale.balance), true);
      y += 4;
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
      doc.text(`Payment method: ${METHODS[sale.paymentMethod] || sale.paymentMethod}`, 40, y);

      doc.moveDown(2);
      doc.fillColor("#111827").fontSize(10).text(settings.thankYouMessage || "", 40, doc.y + 20, { width: W, align: "center" });
      if (settings.invoiceFooter) doc.fillColor("#6b7280").fontSize(8).text(settings.invoiceFooter, 40, doc.y + 6, { width: W, align: "center" });
    },
    { size: "A5" }
  );

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sale.orderNumber}.pdf"`,
    },
  });
}
