import Link from "next/link";
import { Hammer } from "lucide-react";

// Temporary page body for sections that are built in later steps.
export default function ComingSoon({ title, description, actionHref, actionLabel }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Hammer className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-gray-900">Coming in the next steps</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
        {actionHref && (
          <Link
            href={actionHref}
            className="mt-5 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
