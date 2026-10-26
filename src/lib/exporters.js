import { formatNGN } from "./money";
import { renderPdf, drawTable } from "./pdfKit";

// Turns a report (from reportData.js) into CSV, Excel or PDF.

function tablesOf(report) {
  const main = { title: null, columns: report.columns, rows: report.rows, totals: report.totals };
  return [main, ...(report.extraTables || [])];
}

// Stops spreadsheet apps from running cell contents that start with = + - @
function safeText(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return text;
}

function csvCell(value) {
  return `"${safeText(value).replace(/"/g, '""')}"`;
}

export function toCsv(report) {
  const out = [];
  out.push([report.title]);
  if (report.subtitle) out.push([report.subtitle]);
  out.push([]);
  for (const s of report.summary || []) out.push([s.label, s.value]);
  for (const t of tablesOf(report)) {
    out.push([]);
    if (t.title) out.push([t.title]);
    out.push(t.columns.map((c) => c.label));
    for (const r of t.rows) out.push(t.columns.map((c) => r[c.key]));
    if (t.totals) out.push(t.columns.map((c) => t.totals[c.key] ?? ""));
  }
  return "﻿" + out.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function toXlsx(report) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Blaqo Sales Tracker";
  const ws = wb.addWorksheet("Report");

  ws.addRow([report.title]).font = { bold: true, size: 14 };
  if (report.subtitle) ws.addRow([report.subtitle]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([]);
  for (const s of report.summary || []) {
    const row = ws.addRow([s.label, typeof s.value === "number" ? s.value : safeText(s.value)]);
    row.getCell(1).font = { bold: true };
    if (s.kind === "money") row.getCell(2).numFmt = '"₦"#,##0.00';
  }

  let maxCols = 2;
  for (const t of tablesOf(report)) {
    ws.addRow([]);
    if (t.title) ws.addRow([t.title]).font = { bold: true };
    const head = ws.addRow(t.columns.map((c) => c.label));
    head.font = { bold: true };
    head.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    });
    const addData = (obj, bold) => {
      const row = ws.addRow(t.columns.map((c) => (typeof obj[c.key] === "number" ? obj[c.key] : safeText(obj[c.key] ?? ""))));
      t.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.kind === "money" && typeof obj[c.key] === "number") cell.numFmt = '"₦"#,##0.00';
        if (c.kind === "pct" && typeof obj[c.key] === "number") cell.numFmt = '0.00"%"';
        if (c.align === "right") cell.alignment = { horizontal: "right" };
      });
      if (bold) row.font = { bold: true };
    };
    for (const r of t.rows) addData(r, false);
    if (t.totals) addData(t.totals, true);
    maxCols = Math.max(maxCols, t.columns.length);
  }

  for (let i = 1; i <= maxCols; i++) {
    const col = ws.getColumn(i);
    let w = 12;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > w) w = Math.min(len + 2, 48);
    });
    col.width = w;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function pdfValue(v, kind) {
  if (v === null || v === undefined) return "";
  if (kind === "money" && typeof v === "number") return formatNGN(v);
  if (kind === "pct" && typeof v === "number") return `${v.toFixed(1)}%`;
  return String(v);
}

export function toPdf(report) {
  const wide = tablesOf(report)[0].columns.length > 7;
  return renderPdf(
    (doc) => {
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(report.title);
      if (report.subtitle) doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(report.subtitle);
      doc.moveDown(0.6);

      doc.font("Helvetica").fontSize(9).fillColor("#111827");
      for (const s of report.summary || []) {
        doc.text(`${s.label}: `, { continued: true }).font("Helvetica-Bold").text(pdfValue(s.value, s.kind)).font("Helvetica");
      }

      for (const t of tablesOf(report)) {
        doc.moveDown(0.8);
        if (t.title) doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(t.title).moveDown(0.3);
        const totalW = t.columns.reduce((n, c) => n + (c.wide ? 3 : c.kind === "money" ? 1.4 : 1), 0);
        const cols = t.columns.map((c) => ({ label: c.label, align: c.align, width: (c.wide ? 3 : c.kind === "money" ? 1.4 : 1) / totalW }));
        const rows = t.rows.map((r) => t.columns.map((c) => pdfValue(r[c.key], c.kind)));
        if (t.totals) rows.push(t.columns.map((c) => pdfValue(t.totals[c.key], c.kind)));
        drawTable(doc, cols, rows, { fontSize: wide ? 7 : 8.5 });
      }
    },
    { layout: wide ? "landscape" : "portrait", size: "A4" }
  );
}
