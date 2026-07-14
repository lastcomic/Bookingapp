import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isOfficeAuthed } from "@/lib/auth";
import { ARTIST_ID } from "@/lib/settings";

export const dynamic = "force-dynamic";

// The repeat-buyer verification list: venues John has worked before.
export async function GET() {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { rows } = await query<{ name: string }>(
    "SELECT name FROM past_venues WHERE artist_id = $1 ORDER BY name",
    [ARTIST_ID]
  );
  return NextResponse.json({ venues: rows.map((r) => r.name) });
}

export async function PUT(req: NextRequest) {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const venues: string[] = Array.isArray(body.venues)
    ? body.venues.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];
  await query("DELETE FROM past_venues WHERE artist_id = $1", [ARTIST_ID]);
  for (const name of [...new Set(venues)]) {
    await query(
      "INSERT INTO past_venues (artist_id, name) VALUES ($1, $2)",
      [ARTIST_ID, name]
    );
  }
  return NextResponse.json({ venues });
}
