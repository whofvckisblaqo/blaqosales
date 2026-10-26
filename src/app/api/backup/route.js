import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized } from "@/lib/api";
import { createBackup } from "@/lib/backup";

export async function GET() {
  if (!(await requireUser())) return unauthorized();
  await connectDB();
  const backup = await createBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="blaqo-backup-${stamp}.json"`,
    },
  });
}
