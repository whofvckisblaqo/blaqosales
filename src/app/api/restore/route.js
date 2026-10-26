import connectDB from "@/lib/mongodb";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { validateBackup, restoreBackup } from "@/lib/backup";

export async function POST(request) {
  if (!(await requireUser())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return fail("Could not read that file.");
  if (body.confirm !== "RESTORE") return fail('Type RESTORE to confirm.');

  const problem = validateBackup(body.backup);
  if (problem) return fail(problem);

  await connectDB();
  try {
    await restoreBackup(body.backup);
  } catch (err) {
    console.error("Restore failed, previous data was put back:", err);
    return fail("The restore failed, so your current data was left as it was.", 500);
  }
  return Response.json({ restored: true });
}
