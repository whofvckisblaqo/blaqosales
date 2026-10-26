import { Suspense } from "react";
import SuppliersContent from "@/components/suppliers/SuppliersContent";

export const metadata = {
  title: "Suppliers | Blaqo Sales Tracker",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuppliersContent />
    </Suspense>
  );
}
