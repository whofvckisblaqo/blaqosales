import Customer from "@/models/Customer";
import { escapeRegex } from "./api";

// Finds the customer by phone (or exact name) or creates one. Returns null for walk-ins.
export async function resolveCustomer(name, phone) {
  if (!name && !phone) return null;

  let customer = null;
  if (phone) {
    customer = await Customer.findOne({ phone });
  } else {
    customer = await Customer.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      phone: "",
    });
  }
  if (customer) return customer;

  return Customer.create({ name: name || `Customer ${phone}`, phone });
}
