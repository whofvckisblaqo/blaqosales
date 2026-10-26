import { Suspense } from "react";
import SalesContent from "@/components/sales/SalesContent";

export const metadata = {
  title: "Sales | Blaqo Sales Tracker",
};

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesContent />
    </Suspense>
  );
}
