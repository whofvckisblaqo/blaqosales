import { auth, signOut } from "@/auth";
import connectDB from "@/lib/mongodb";
import { getSettings } from "@/models/Settings";
import AppShell from "./AppShell";

// Server wrapper: reads the session and hands the shell what it needs.
export default async function AppShellLoader({ children }) {
  const session = await auth();

  let businessName = session?.user?.businessName || "Blaqo Scents";
  try {
    await connectDB();
    businessName = (await getSettings()).businessName || businessName;
  } catch {
    // The shell still works if settings cannot be read.
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AppShell businessName={businessName} userName={session?.user?.name || ""} signOutAction={signOutAction}>
      {children}
    </AppShell>
  );
}
