import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  computeQuote,
  offerMeetsThreshold,
  spanDaysForShows,
  OfferTerms,
} from "@/lib/engine";
import { getConfig, ARTIST_ID } from "@/lib/settings";
import { driveMinutes } from "@/lib/distance";
import { heldDates } from "@/lib/calendar";
import { addDays, isValidISODate, spanDates, todayISO } from "@/lib/dates";
import { notifyJohn, SubmissionRecord } from "@/lib/email";

export const dynamic = "force-dynamic";

const DECLINE_MESSAGE =
  "This offer falls outside standard terms for a room of this size. " +
  "The standard deal remains available.";

async function emailVerified(email: string): Promise<boolean> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*) FROM email_verifications
     WHERE email = $1 AND verified_at IS NOT NULL
       AND verified_at > now() - interval '2 hours'`,
    [email]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function venueOnRecord(venue: string): Promise<boolean> {
  const normalized = venue.trim().toLowerCase();
  const { rows } = await query<{ name: string }>(
    "SELECT name FROM past_venues WHERE artist_id = $1",
    [ARTIST_ID]
  );
  return rows.some((r) => {
    const known = r.name.trim().toLowerCase();
    return known === normalized || known.includes(normalized) || normalized.includes(known);
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const kind = body.kind === "offer" ? "offer" : "request";
  const buyerName = String(body.buyerName || "").trim();
  const buyerEmail = String(body.buyerEmail || "").trim().toLowerCase();
  const buyerPhone = String(body.buyerPhone || "").trim();
  const venue = String(body.venue || "").trim();
  const address = String(body.address || "").trim();
  const capacity = Math.round(Number(body.capacity));
  const ticketPrice = Number(body.ticketPrice);
  const shows = Math.round(Number(body.shows));
  const startDate = body.startDate;
  const repeatClaim = body.repeatClaim === true;

  if (!buyerName || !buyerEmail || !buyerPhone) {
    return NextResponse.json(
      { error: "Name, email, and phone are required" },
      { status: 400 }
    );
  }
  if (
    !venue || !address ||
    !isValidISODate(startDate) || startDate < todayISO() ||
    !Number.isFinite(capacity) || capacity <= 0 ||
    !Number.isFinite(ticketPrice) || ticketPrice <= 0 ||
    !Number.isFinite(shows) || shows < 1 || shows > 6
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const cfg = await getConfig();
  if (capacity < cfg.minCapacity) {
    return NextResponse.json(
      { error: "For rooms of this size, contact the office directly." },
      { status: 400 }
    );
  }

  if (cfg.requireEmailVerification && !(await emailVerified(buyerEmail))) {
    return NextResponse.json(
      { error: "Please verify your email before submitting" },
      { status: 403 }
    );
  }

  // Recompute the engagement span and re-check holds at submit time.
  const spanDays = spanDaysForShows(shows);
  const endDate = addDays(startDate, spanDays - 1);
  const dates = spanDates(startDate, spanDays);
  const held = await heldDates(startDate, addDays(endDate, 1));
  if (dates.some((d) => held.includes(d))) {
    return NextResponse.json(
      { error: "Those dates are no longer available. Please choose a different start date." },
      { status: 409 }
    );
  }

  // Engine quote is always recomputed server-side at submit time.
  const minutes = await driveMinutes(cfg.homeBase, address);
  const quote = computeQuote(cfg, {
    capacity,
    ticketPrice,
    shows,
    startDate,
    driveMinutes: minutes,
    firstTime: !repeatClaim,
  });

  let offer: OfferTerms | null = null;
  if (kind === "offer") {
    const guarantee = Number(body.offer?.guarantee);
    const doorPct = Number(body.offer?.doorPct) || 0;
    const travel = Number(body.offer?.travel) || 0;
    const hotel = body.offer?.hotel === true;
    if (!Number.isFinite(guarantee) || guarantee <= 0 || doorPct < 0 || doorPct > 100 || travel < 0) {
      return NextResponse.json({ error: "Invalid offer terms" }, { status: 400 });
    }
    offer = { guarantee, doorPct, travel, hotel };
  }

  const repeatVerified = repeatClaim ? await venueOnRecord(venue) : false;

  const autoDeclined =
    kind === "offer" && offer !== null && !offerMeetsThreshold(cfg, quote, offer);

  const { rows } = await query<{ id: number }>(
    `INSERT INTO submissions
       (artist_id, kind, status, buyer_name, buyer_email, buyer_phone, venue,
        address, capacity, ticket_price, shows, start_date, end_date,
        repeat_claim, repeat_verified, drive_minutes, quote, offer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      ARTIST_ID,
      kind,
      autoDeclined ? "auto_declined" : "new",
      buyerName,
      buyerEmail,
      buyerPhone,
      venue,
      address,
      capacity,
      ticketPrice,
      shows,
      startDate,
      endDate,
      repeatClaim,
      repeatVerified,
      minutes,
      JSON.stringify(quote),
      offer ? JSON.stringify(offer) : null,
    ]
  );

  // Auto-declines are logged and answered instantly. John never sees them.
  if (autoDeclined) {
    return NextResponse.json({ declined: true, message: DECLINE_MESSAGE });
  }

  const record: SubmissionRecord = {
    id: rows[0].id,
    kind,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    buyer_phone: buyerPhone,
    venue,
    address,
    capacity,
    ticket_price: ticketPrice,
    shows,
    start_date: startDate,
    end_date: endDate,
    repeat_claim: repeatClaim,
    repeat_verified: repeatVerified,
    quote,
    offer,
  };
  await notifyJohn(cfg, record);

  return NextResponse.json({
    submitted: true,
    message: "The office reviews all requests and responds within 48 hours.",
  });
}
