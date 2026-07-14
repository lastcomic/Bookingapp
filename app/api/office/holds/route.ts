import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isOfficeAuthed } from "@/lib/auth";
import { ARTIST_ID } from "@/lib/settings";
import { clearHeldCache, heldDates, manualHolds } from "@/lib/calendar";
import { isValidISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Manual holds: dates John blocks by hand, no calendar setup needed.
// GET returns both the manual holds (editable) and everything held
// (calendar sync + accepted engagements + manual) for a window.
export async function GET(req: NextRequest) {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isValidISODate(from) || !isValidISODate(to) || to <= from) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const [manual, held] = await Promise.all([
    manualHolds(from, to),
    heldDates(from, to, true),
  ]);
  return NextResponse.json({ manual, held });
}

export async function POST(req: NextRequest) {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const add: string[] = Array.isArray(body.add) ? body.add.filter(isValidISODate) : [];
  const remove: string[] = Array.isArray(body.remove) ? body.remove.filter(isValidISODate) : [];
  for (const d of add) {
    await query(
      `INSERT INTO manual_holds (artist_id, hold_date) VALUES ($1, $2)
       ON CONFLICT (artist_id, hold_date) DO NOTHING`,
      [ARTIST_ID, d]
    );
  }
  if (remove.length > 0) {
    await query(
      "DELETE FROM manual_holds WHERE artist_id = $1 AND hold_date = ANY($2::date[])",
      [ARTIST_ID, remove]
    );
  }
  clearHeldCache();
  return NextResponse.json({ ok: true });
}
