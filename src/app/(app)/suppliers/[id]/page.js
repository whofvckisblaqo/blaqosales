import SupplierProfileContent from "@/components/suppliers/SupplierProfileContent";

export const metadata = {
  title: "Supplier | Blaqo Sales Tracker",
};

export default async function Page({ params }) {
  const { id } = await params;
  return <SupplierProfileContent supplierId={id} />;
}
