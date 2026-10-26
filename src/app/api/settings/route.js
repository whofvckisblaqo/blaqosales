import connectDB from "@/lib/mongodb";
import Settings, { getSettings } from "@/models/Settings";
import { PAYMENT_METHODS } from "@/models/Sale";
import { requireUser, unauthorized, fail } from "@/lib/api";
import { round2 } from "@/lib/money";

export async function GET() {
  if (!(await requireUser())) return unauthorized();
  await connectDB();
  const settings = await getSettings();
  return Response.json({ settings });
}

const text = (v, max = 300) => String(v ?? "").trim().slice(0, max);

export async function PUT(request) {
  if (!(await requireUser())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const businessName = text(body.businessName, 100);
  if (!businessName) return fail("Enter your business name.");

  const logoUrl = text(body.logoUrl, 500);
  if (logoUrl && !/^https?:\/\//i.test(logoUrl) && !/^\//.test(logoUrl)) {
    return fail("The logo must be a web address starting with https://");
  }

  const defaultDiscount = round2(body.defaultDiscount || 0);
  const largeExpenseThreshold = round2(body.largeExpenseThreshold || 0);
  const lowStockThreshold = Math.floor(Number(body.lowStockThreshold ?? 3));
  if (!(lowStockThreshold >= 0)) return fail("The low-stock alert must be 0 or more.");
  if (defaultDiscount < 0 || largeExpenseThreshold < 0) return fail("Amounts cannot be negative.");

  await connectDB();
  await getSettings();
  const settings = await Settings.findOneAndUpdate(
    { key: "main" },
    {
      $set: {
        businessName,
        logoUrl,
        phone: text(body.phone, 40),
        email: text(body.email, 120),
        address: text(body.address, 300),
        taxName: text(body.taxName, 40),
        taxNumber: text(body.taxNumber, 60),
        invoiceFooter: text(body.invoiceFooter, 300),
        thankYouMessage: text(body.thankYouMessage, 200),
        defaultPaymentMethod: PAYMENT_METHODS.includes(body.defaultPaymentMethod) ? body.defaultPaymentMethod : "cash",
        defaultDiscount,
        allowNegativeStock: Boolean(body.allowNegativeStock),
        autoStockDeduction: body.autoStockDeduction !== false,
        largeExpenseThreshold,
        lowStockThreshold,
      },
    },
    { new: true }
  );
  return Response.json({ settings });
}
