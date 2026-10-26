import { requireUser, unauthorized } from "@/lib/api";

// Old address kept so bookmarks keep working. Exports now live at /api/export/sales.
export async function GET(request) {
  if (!(await requireUser())) return unauthorized();
  const url = new URL(request.url);
  url.pathname = "/api/export/sales";
  url.searchParams.set("format", "csv");
  return Response.redirect(url, 307);
}
