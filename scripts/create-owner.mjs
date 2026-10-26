// Creates (or resets) the owner account.
// Run from the project root:
//   node --env-file=.env.local scripts/create-owner.mjs
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

const rl = readline.createInterface({ input, output });

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI missing. Run with: node --env-file=.env.local scripts/create-owner.mjs");
  }

  const name = (await rl.question("Owner name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  const username = (await rl.question("Username (optional, press Enter to skip): ")).trim().toLowerCase();
  const businessName = (await rl.question("Business name [Blaqo Scents]: ")).trim() || "Blaqo Scents";
  const phone = (await rl.question("Phone (optional): ")).trim();
  const password = await rl.question("Password (min 8 characters): ");
  rl.close();

  if (!name || !email || password.length < 8) {
    throw new Error("Name, email and a password of at least 8 characters are required.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const hashed = await bcrypt.hash(password, 12);

  const update = { name, email, businessName, phone, password: hashed };
  if (username) update.username = username;

  const user = await User.findOneAndUpdate({ email }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  console.log(`\nDone. Owner account ready: ${user.email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
