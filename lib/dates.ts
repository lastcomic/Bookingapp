// All engagement dates are plain YYYY-MM-DD strings, timezone-free.

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function spanDates(startDate: string, spanDays: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < spanDays; i++) out.push(addDays(startDate, i));
  return out;
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// "March 6–7, 2026" / "March 31 – April 1, 2026" / single date long form.
export function formatSpan(start: string, end: string): string {
  if (start === end) return formatDateLong(start);
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  const left = `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}`;
  const right = `${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  return `${left} – ${right}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Engagement span (public rule, shown to buyers):
// 1–2 shows = 1 day, 3–4 = 2 days, 5–6 = 3 days.
export function spanDaysForShows(shows: number): number {
  if (shows <= 2) return 1;
  if (shows <= 4) return 2;
  return 3;
}
