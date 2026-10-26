import { todayStr } from "./dates";

export const RANGE_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
];

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return addDays(dateStr, -((d.getUTCDay() + 6) % 7));
}

const fmt = (dateStr, opts) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

// Works out the chart columns for a range:
//   7 / 30 days -> one column per day
//   3 months    -> one column per week
//   6 / 12 mo   -> one column per month
export function buildBuckets(range) {
  const today = todayStr();

  if (range === "7d" || range === "30d") {
    const n = range === "7d" ? 7 : 30;
    const start = addDays(today, -(n - 1));
    const buckets = Array.from({ length: n }, (_, i) => {
      const key = addDays(start, i);
      return { key, label: fmt(key, { day: "numeric", month: "short" }), title: fmt(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
    });
    return { start, buckets, keyOfDay: (d) => d };
  }

  if (range === "3m") {
    const weeks = 13;
    const start = addDays(mondayOf(today), -7 * (weeks - 1));
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const key = addDays(start, i * 7);
      return { key, label: fmt(key, { day: "numeric", month: "short" }), title: `Week of ${fmt(key, { day: "numeric", month: "short", year: "numeric" })}` };
    });
    return { start, buckets, keyOfDay: mondayOf };
  }

  const months = range === "6m" ? 6 : 12;
  const [y, m] = today.split("-").map(Number);
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: fmt(`${key}-01`, { month: "short" }),
      title: fmt(`${key}-01`, { month: "long", year: "numeric" }),
    };
  });
  return { start: `${buckets[0].key}-01`, buckets, keyOfDay: (d) => d.slice(0, 7) };
}
