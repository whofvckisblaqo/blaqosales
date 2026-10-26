import NewSaleContent from "@/components/sales/NewSaleContent";

export const metadata = {
  title: "Edit Sale | Blaqo Sales Tracker",
};

export default async function EditSalePage({ params }) {
  const { id } = await params;
  return <NewSaleContent saleId={id} />;
}
