import PDFDocument from "pdfkit";

// Collects a PDFKit document into a Buffer.
export function renderPdf(build, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", ...options });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Draws a simple table. columns: [{ label, width (0-1 share), align }]. rows: arrays of strings.
export function drawTable(doc, columns, rows, { fontSize = 8, header = true } = {}) {
  const left = doc.page.margins.left;
  const total = doc.page.width - left - doc.page.margins.right;
  const widths = columns.map((c) => c.width * total);
  const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

  function line(cells, bold, shade) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    const heights = cells.map((t, i) => doc.heightOfString(String(t ?? ""), { width: widths[i] - 6 }));
    const h = Math.max(...heights, fontSize) + 6;
    if (doc.y + h > bottom()) {
      doc.addPage();
    }
    const y = doc.y;
    if (shade) doc.save().rect(left, y, total, h).fill("#f3f4f6").restore();
    let x = left;
    cells.forEach((t, i) => {
      doc.fillColor("#111827").text(String(t ?? ""), x + 3, y + 3, { width: widths[i] - 6, align: columns[i].align || "left" });
      x += widths[i];
    });
    doc.y = y + h;
    doc.x = left;
    doc.moveTo(left, doc.y).lineTo(left + total, doc.y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

  if (header) line(columns.map((c) => c.label), true, true);
  for (const r of rows) line(r, false, false);
}
