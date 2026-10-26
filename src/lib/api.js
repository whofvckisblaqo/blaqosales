import mongoose from "mongoose";
import { auth } from "@/auth";

// Returns the signed-in user, or null.
export async function requireUser() {
  const session = await auth();
  return session?.user || null;
}

export function unauthorized() {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

export function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
