import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { buildReport } from "@/lib/reportData";
import { toCsv, toXlsx, toPdf } from "@/lib/exporters";

export async function GET(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { type } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  if (!["csv", "xlsx", "pdf"].includes(format)) return fail("Unknown file format.");

  await connectDB();
  const report = await buildReport(type, searchParams);
  if (report.error) return fail(report.error);

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${type}-${stamp}`;

  if (format === "csv") {
    return new Response(toCsv(report), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` },
    });
  }
  if (format === "xlsx") {
    const buf = await toXlsx(report);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  }
  const pdf = await toPdf(report);
  return new Response(pdf, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
  });
}
