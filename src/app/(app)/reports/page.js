import { Suspense } from "react";
import ReportsContent from "@/components/reports/ReportsContent";

export const metadata = {
  title: "Reports | Blaqo Sales Tracker",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportsContent />
    </Suspense>
  );
}
