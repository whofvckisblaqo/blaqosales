import CustomerProfileContent from "@/components/customers/CustomerProfileContent";

export const metadata = {
  title: "Customer | Blaqo Sales Tracker",
};

export default async function CustomerPage({ params }) {
  const { id } = await params;
  return <CustomerProfileContent id={id} />;
}
