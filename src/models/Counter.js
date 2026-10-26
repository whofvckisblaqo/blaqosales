import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

// Atomic auto-increment. Pass the transaction session so a failed sale
// does not burn a number.
export async function nextSequence(name, session) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return doc.seq;
}

export async function nextOrderNumber(session) {
  const seq = await nextSequence("sale", session);
  return `SALE-${String(seq).padStart(6, "0")}`;
}

export default Counter;
