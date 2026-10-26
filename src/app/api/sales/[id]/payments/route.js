import connectDB from "@/lib/mongodb";
import Sale, { PAYMENT_METHODS } from "@/models/Sale";
import Payment from "@/models/Payment";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { round2, formatNaira, balanceOf } from "@/lib/money";

// Records a payment from a customer against what they owe on a sale.
export async function POST(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Sale not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const amount = round2(body.amount);
  if (!(Number(body.amount) > 0) || amount <= 0) return fail("Enter an amount above 0.");

  const method = PAYMENT_METHODS.includes(body.method) ? body.method : "cash";
  const reference = String(body.reference || "").trim().slice(0, 100);

  await connectDB();

  // Update the sale. Retries if two payments land at the same moment.
  let before = null;
  let sale = null;
  for (let attempt = 0; attempt < 5 && !sale; attempt++) {
    before = await Sale.findById(id);
    if (!before) return fail("Sale not found.", 404);
    if (before.balance <= 0) return fail("This sale is already fully paid.");
    if (amount > before.balance) {
      return fail(`That is more than the balance of ${formatNaira(before.balance)}.`);
    }

    const amountPaid = round2(before.amountPaid + amount);
    const balance = balanceOf({ ...before.toObject(), amountPaid });

    sale = await Sale.findOneAndUpdate(
      { _id: id, amountPaid: before.amountPaid },
      { $set: { amountPaid, balance, paymentStatus: balance <= 0 ? "paid" : "partial" } },
      { new: true }
    );
  }
  if (!sale) return fail("Could not record the payment. Please try again.", 409);

  try {
    const payment = await Payment.create({ sale: sale._id, type: "payment", source: "debt", amount, method, date: new Date(), reference });
    return Response.json({ sale, payment }, { status: 201 });
  } catch (err) {
    // Undo the change to the sale so the books stay correct.
    await Sale.updateOne(
      { _id: id },
      { $set: { amountPaid: before.amountPaid, balance: before.balance, paymentStatus: before.paymentStatus } }
    );
    console.error("Payment failed and was rolled back:", err);
    return fail("The payment could not be saved. Nothing was changed. Please try again.", 500);
  }
}
