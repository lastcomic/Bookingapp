// Read-only sync of John's Google Calendar for held dates, plus engagements
// accepted in the app. Supports a service account (private calendar) or an
// API key (public calendar). Without either, only app-accepted dates hold.

import crypto from "crypto";
import { query } from "@/lib/db";
import { addDays } from "@/lib/dates";

const cache = new Map<string, { dates: string[]; at: number }>();
const CACHE_MS = 5 * 60 * 1000;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function serviceAccountToken(): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    );
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const signature = base64url(signer.sign(sa.private_key));
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${signature}`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function googleHeldDates(timeMin: string, timeMax: string): Promise<string[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return [];
  try {
    const params = new URLSearchParams({
      timeMin: `${timeMin}T00:00:00Z`,
      timeMax: `${timeMax}T00:00:00Z`,
      singleEvents: "true",
      maxResults: "250",
    });
    const headers: Record<string, string> = {};
    const token = await serviceAccountToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (process.env.GOOGLE_CALENDAR_API_KEY) {
      params.set("key", process.env.GOOGLE_CALENDAR_API_KEY);
    } else {
      return [];
    }
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/` +
      `${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const dates = new Set<string>();
    for (const event of data.items || []) {
      if (event.status === "cancelled" || event.transparency === "transparent")
        continue;
      let start: string | undefined;
      let endExclusive: string | undefined;
      if (event.start?.date) {
        start = event.start.date;
        endExclusive = event.end?.date || addDays(event.start.date, 1);
      } else if (event.start?.dateTime) {
        start = event.start.dateTime.slice(0, 10);
        endExclusive = addDays(
          (event.end?.dateTime || event.start.dateTime).slice(0, 10),
          1
        );
      }
      if (!start || !endExclusive) continue;
      for (let d = start; d < endExclusive; d = addDays(d, 1)) dates.add(d);
    }
    return [...dates];
  } catch {
    return [];
  }
}

async function acceptedDates(timeMin: string, timeMax: string): Promise<string[]> {
  try {
    const { rows } = await query<{ start_date: string; end_date: string }>(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM submissions
       WHERE status = 'accepted' AND end_date >= $1 AND start_date < $2`,
      [timeMin, timeMax]
    );
    const dates: string[] = [];
    for (const row of rows) {
      for (let d = row.start_date; d <= row.end_date; d = addDays(d, 1)) {
        dates.push(d);
      }
    }
    return dates;
  } catch {
    return [];
  }
}

// Dates John blocked by hand in the office.
export async function manualHolds(timeMin: string, timeMax: string): Promise<string[]> {
  try {
    const { rows } = await query<{ hold_date: string }>(
      `SELECT to_char(hold_date, 'YYYY-MM-DD') AS hold_date
       FROM manual_holds WHERE hold_date >= $1 AND hold_date < $2`,
      [timeMin, timeMax]
    );
    return rows.map((r) => r.hold_date);
  } catch {
    return [];
  }
}

export function clearHeldCache(): void {
  cache.clear();
}

// Held dates in [timeMin, timeMax) as YYYY-MM-DD. Only "HELD" — never
// where, who, or for how much.
export async function heldDates(
  timeMin: string,
  timeMax: string,
  fresh = false
): Promise<string[]> {
  const key = `${timeMin}|${timeMax}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.dates;
  const [google, accepted, manual] = await Promise.all([
    googleHeldDates(timeMin, timeMax),
    acceptedDates(timeMin, timeMax),
    manualHolds(timeMin, timeMax),
  ]);
  const dates = [...new Set([...google, ...accepted, ...manual])].sort();
  cache.set(key, { dates, at: Date.now() });
  return dates;
}
