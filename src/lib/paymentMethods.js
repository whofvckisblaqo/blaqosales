export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const METHOD_LABELS = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((m) => [m.value, m.label]));
