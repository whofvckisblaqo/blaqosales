import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { fail } from "@/lib/api";

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Creates the first (owner) account. Works only while there are no accounts at all,
// and only for someone who knows the AUTH_SECRET from the server settings.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  await connectDB();
  if ((await User.countDocuments()) > 0) return fail("Setup is already done. Please sign in.", 403);

  const secret = process.env.AUTH_SECRET || "";
  if (!secret || !sameSecret(body.setupKey || "", secret)) return fail("The setup key is wrong.", 403);

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const businessName = String(body.businessName || "").trim() || "Blaqo Scents";
  const password = String(body.password || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter your name and a valid email.");
  if (password.length < 8) return fail("The password must be at least 8 characters.");

  await User.create({ name, email, businessName, password: await bcrypt.hash(password, 12) });
  return Response.json({ created: true }, { status: 201 });
}
