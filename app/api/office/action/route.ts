import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isOfficeAuthed } from "@/lib/auth";
import { getConfig } from "@/lib/settings";
import {
  sendDealSheet,
  sendBuyerAcceptance,
  sendCounterMemo,
  sendCustomCounter,
  sendBuyerDecline,
  CounterTerms,
  SubmissionRecord,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const ACTIONS = ["accept", "counter", "counter_custom", "decline"];

// Accept / Counter with engine quote / Counter with your own number /
// Decline. Nothing is binding until John taps Accept here.
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
  if (!Number.isInteger(id) || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Validate a custom counter before touching the row.
  let counter: CounterTerms | null = null;
  if (action === "counter_custom") {
    const c = body.counter || {};
    const guarantee = Number(c.guarantee);
    const doorPct = Number(c.doorPct) || 0;
    const travel = Number(c.travel) || 0;
    const bonus = Number(c.bonus) || 0;
    if (!Number.isFinite(guarantee) || guarantee <= 0 || doorPct < 0 || doorPct > 100 || travel < 0) {
      return NextResponse.json({ error: "Invalid counter terms" }, { status: 400 });
    }
    counter = {
      guarantee,
      doorPct,
      travel,
      hotel: c.hotel === true,
      ...(bonus > 0 ? { bonus } : {}),
      ...(String(c.bonusTerms || "").trim()
        ? { bonusTerms: String(c.bonusTerms).trim().slice(0, 300) }
        : {}),
      ...(String(c.message || "").trim()
        ? { message: String(c.message).trim().slice(0, 1000) }
        : {}),
    };
  }

  const status =
    action === "accept"
      ? "accepted"
      : action === "counter" || action === "counter_custom"
      ? "countered"
      : "declined";
  const { rows } = await query<any>(
    `UPDATE submissions
     SET status = $2, decided_at = now(), counter = $3
     WHERE id = $1 AND status IN ('new', 'countered')
     RETURNING id, kind, buyer_name, buyer_email, buyer_phone, venue, address,
               capacity, ticket_price::float AS ticket_price, shows,
               to_char(start_date, 'YYYY-MM-DD') AS start_date,
               to_char(end_date, 'YYYY-MM-DD') AS end_date,
               repeat_claim, repeat_verified, quote, offer`,
    [id, status, counter ? JSON.stringify(counter) : null]
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
  } else if (action === "counter_custom" && counter) {
    await sendCustomCounter(record, counter);
  } else {
    await sendBuyerDecline(record);
  }

  return NextResponse.json({ ok: true, status });
}
