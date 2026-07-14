import { NextRequest, NextResponse } from "next/server";
import { heldDates } from "@/lib/calendar";
import { isValidISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Held dates in a window. Dates only — never where, who, or for how much.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isValidISODate(from) || !isValidISODate(to) || to <= from) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const held = await heldDates(from, to);
  return NextResponse.json({ held });
}
