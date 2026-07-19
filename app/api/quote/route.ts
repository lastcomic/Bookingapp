import { NextRequest, NextResponse } from "next/server";
import { computeQuote, toPublicQuote, spanDaysForShows } from "@/lib/engine";
import { getConfig } from "@/lib/settings";
import { driveMinutes } from "@/lib/distance";
import { heldDates } from "@/lib/calendar";
import { addDays, isValidISODate, spanDates, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Renders the live deal memo. All math stays server-side; the response is
// limited to PublicQuote — no floors, no gross potential, no walkout.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const capacity = Math.round(Number(body.capacity));
  // Ticket price is optional; without it the engine falls back to the floor.
  const rawPrice = Number(body.ticketPrice);
  const ticketPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  const shows = Math.round(Number(body.shows));
  const startDate = body.startDate;
  const firstTime = body.firstTime !== false;
  const address = String(body.address || "");

  if (
    !isValidISODate(startDate) ||
    !Number.isFinite(capacity) || capacity <= 0 ||
    !Number.isFinite(shows) || shows < 1 || shows > 6
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (startDate < todayISO()) {
    return NextResponse.json({ error: "Date is in the past" }, { status: 400 });
  }

  const cfg = await getConfig();

  if (capacity < cfg.minCapacity) {
    return NextResponse.json({ belowMinimum: true });
  }

  const spanDays = spanDaysForShows(shows);
  const endDate = addDays(startDate, spanDays - 1);
  const dates = spanDates(startDate, spanDays);
  const held = await heldDates(startDate, addDays(endDate, 1));
  const collisions = dates.filter((d) => held.includes(d));
  if (collisions.length > 0) {
    return NextResponse.json({
      collision: true,
      span: { start: startDate, end: endDate },
    });
  }

  // Offer-first: the buyer speaks first, so the engine number never reaches
  // the browser. It stays server-side for the office inbox only.
  if (cfg.offerFirst) {
    return NextResponse.json({
      span: { start: startDate, end: endDate },
      offerFirst: true,
      verificationRequired: cfg.requireEmailVerification === true,
    });
  }

  const minutes = await driveMinutes(cfg.homeBase, address);
  const quote = computeQuote(cfg, {
    capacity,
    ticketPrice,
    shows,
    startDate,
    driveMinutes: minutes,
    firstTime,
  });

  return NextResponse.json({
    span: { start: startDate, end: endDate },
    quote: toPublicQuote(quote, shows),
    offerFirst: false,
    verificationRequired: cfg.requireEmailVerification === true,
  });
}
