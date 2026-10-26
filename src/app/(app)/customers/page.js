import { Suspense } from "react";
import CustomersContent from "@/components/customers/CustomersContent";

export const metadata = {
  title: "Customers | Blaqo Sales Tracker",
};

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersContent />
    </Suspense>
  );
}
