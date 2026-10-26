import connectDB from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireUser, unauthorized, fail, isValidId } from "@/lib/api";
import { parseExpenseInput } from "@/lib/expenseInput";

const LOCKED_MESSAGE =
  "This expense was created automatically by a sale or a stock delivery. Change it there instead.";

export async function PUT(request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Expense not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request.");

  const parsed = parseExpenseInput(body);
  if (parsed.error) return fail(parsed.error);

  await connectDB();
  const expense = await Expense.findById(id);
  if (!expense) return fail("Expense not found.", 404);
  if (expense.kind !== "operating") return fail(LOCKED_MESSAGE, 400);

  Object.assign(expense, parsed.data);
  await expense.save();
  return Response.json({ expense });
}

export async function DELETE(_request, { params }) {
  if (!(await requireUser())) return unauthorized();
  const { id } = await params;
  if (!isValidId(id)) return fail("Expense not found.", 404);

  await connectDB();
  const expense = await Expense.findById(id);
  if (!expense) return fail("Expense not found.", 404);
  if (expense.kind !== "operating") return fail(LOCKED_MESSAGE, 400);

  await expense.deleteOne();
  return Response.json({ deleted: true });
}
