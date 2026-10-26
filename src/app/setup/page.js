import { redirect } from "next/navigation";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import SetupContent from "./SetupContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup | Blaqo Sales Tracker",
};

export default async function SetupPage() {
  await connectDB();
  // Once an account exists this page is gone for good.
  if ((await User.countDocuments()) > 0) redirect("/login");
  return <SetupContent />;
}
