import { Suspense } from "react";
import ProductsContent from "@/components/products/ProductsContent";

export const metadata = {
  title: "Products | Blaqo Sales Tracker",
};

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
