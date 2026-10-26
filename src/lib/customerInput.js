// Validates the customer form. Returns { data } or { error }.
export function parseCustomerInput(body) {
  const name = String(body.name || "").trim();
  if (!name) return { error: "Enter the customer's name." };

  const email = String(body.email || "").trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address, or leave it empty." };

  return {
    data: {
      name: name.slice(0, 120),
      phone: String(body.phone || "").trim().slice(0, 30),
      email,
      address: String(body.address || "").trim().slice(0, 300),
    },
  };
}
