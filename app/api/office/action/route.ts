import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isOfficeAuthed } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import {
  sendDealSheet,
  sendBuyerAcceptance,
  sendCounterMemo,
  sendBuyerDecline,
  SubmissionRecord,
} from "@/lib/email";

export const dynamic = "force-dynamic";

// Accept / Counter with engine quote / Decline. Nothing is binding until
// John taps Accept here.
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
  const id = Number(body.id);
  const action = String(body.action);
  if (!Number.isInteger(id) || !["accept", "counter", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const status =
    action === "accept" ? "accepted" : action === "counter" ? "countered" : "declined";
  const { rows } = await query<any>(
    `UPDATE submissions
     SET status = $2, decided_at = now()
     WHERE id = $1 AND status IN ('new', 'countered')
     RETURNING id, kind, buyer_name, buyer_email, buyer_phone, venue, address,
               capacity, ticket_price::float AS ticket_price, shows,
               to_char(start_date, 'YYYY-MM-DD') AS start_date,
               to_char(end_date, 'YYYY-MM-DD') AS end_date,
               repeat_claim, repeat_verified, quote, offer`,
    [id, status]
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Item not found or already decided" },
      { status: 404 }
    );
  }
  const record = rows[0] as SubmissionRecord;
  const cfg = await getConfig();

  if (action === "accept") {
    await sendDealSheet(cfg, record);
    await sendBuyerAcceptance(record);
  } else if (action === "counter") {
    await sendCounterMemo(cfg, record);
  } else {
    await sendBuyerDecline(record);
  }

  return NextResponse.json({ ok: true, status });
}
