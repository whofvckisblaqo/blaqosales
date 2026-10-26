// The business runs on Nigerian time (WAT, UTC+01:00, no daylight saving).
export const TIME_ZONE = "Africa/Lagos";
export const OFFSET = "+01:00";

// "2026-09-01" -> start / end of that day in Nigerian time.
export function startOfDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function endOfDay(dateStr) {
  const d = new Date(`${dateStr}T23:59:59.999${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 01/09/2026
export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { timeZone: TIME_ZONE });
}

// 2:35 PM
export function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---- "Today", "this week" and "this month" in Nigerian time ----

// "2026-09-01" for today in Nigerian time, whatever the server's clock zone is.
export function todayStr() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Monday of the current week.
export function weekStartStr() {
  const d = new Date(`${todayStr()}T00:00:00Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

export function monthStartStr() {
  return `${todayStr().slice(0, 8)}01`;
}

// A stored date as "2026-09-01" for a date input (Nigerian time).
export function dateInputValue(value) {
  return new Date(new Date(value).getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// A date picked without a time is saved at midday so it can never slip into another day.
export function noonOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00.000${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
