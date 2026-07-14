import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isOfficeAuthed } from "@/lib/auth";
import { ARTIST_ID } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Inbox: everything except auto-declines, which are logged but never shown.
export async function GET() {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { rows } = await query(
    `SELECT id, kind, status, buyer_name, buyer_email, buyer_phone, venue,
            address, capacity, ticket_price::float AS ticket_price, shows,
            to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date,
            repeat_claim, repeat_verified, drive_minutes, quote, offer,
            created_at
     FROM submissions
     WHERE artist_id = $1 AND status <> 'auto_declined'
     ORDER BY (status = 'new') DESC, created_at DESC
     LIMIT 200`,
    [ARTIST_ID]
  );
  return NextResponse.json({ items: rows });
}
