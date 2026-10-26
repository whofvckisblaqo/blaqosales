const STYLES = {
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
  partial: { label: "Partially Paid", className: "bg-amber-50 text-amber-700" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
};

export default function SaleStatusBadge({ sale }) {
  const s = sale.isOverdue ? STYLES.overdue : STYLES[sale.paymentStatus] || STYLES.unpaid;
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
