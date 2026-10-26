import ReceiptContent from "@/components/receipt/ReceiptContent";

export const metadata = {
  title: "Receipt | Blaqo Sales Tracker",
};

export default async function ReceiptPage({ params }) {
  const { id } = await params;
  return <ReceiptContent saleId={id} />;
}
