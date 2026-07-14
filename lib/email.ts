// Transactional email via the Resend REST API. Without RESEND_API_KEY the
// send is logged to the server console instead (local preview).

import { EngineConfig, EngineQuote, OfferTerms } from "@/lib/engine";
import { formatSpan } from "@/lib/dates";

type Mail = { to: string; subject: string; text: string };

export async function sendMail({ to, subject, text }: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "The Office <office@example.com>";
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`Resend failed (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend error:", err);
    return false;
  }
}

export type SubmissionRecord = {
  id: number;
  kind: "request" | "offer";
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  venue: string;
  address: string;
  capacity: number;
  ticket_price: number;
  shows: number;
  start_date: string;
  end_date: string;
  repeat_claim: boolean;
  repeat_verified: boolean;
  quote: EngineQuote;
  offer: OfferTerms | null;
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function cityFromAddress(address: string): string {
  // Best effort: "Venue St, City, ST 48000" → "City, ST"
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].replace(/\d{5}(-\d{4})?/g, "").trim();
    const city = parts[parts.length - 2];
    return state ? `${city}, ${state}` : city;
  }
  return address;
}

function baseUrl(): string {
  return (
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

function termsLines(cfg: EngineConfig, s: SubmissionRecord): string[] {
  const q = s.quote;
  const lines = [
    `FEE: ${money(q.guarantee)} Guarantee vs ${q.doorPct}% of gross box office receipts, whichever is greater`,
    `+ ${money(q.selloutBonus)} per sellout`,
  ];
  if (q.travelBuyout > 0) lines.push(`${money(q.travelBuyout)} air/ground travel buyout`);
  lines.push("Hotel provided by purchaser. No comps without Artist approval.");
  if (s.shows >= 4) lines.push("Thursday arrival for press");
  if (q.depositPct > 0) {
    lines.push(
      `${q.depositPct}% deposit due ${q.depositDueHours} hours after contract — first-time buyer`
    );
  }
  return lines;
}

// 1. New request/offer → John, with a deep link to the inbox item.
export async function notifyJohn(cfg: EngineConfig, s: SubmissionRecord): Promise<void> {
  const to = process.env.BOOKING_NOTIFY_EMAIL;
  if (!to) return;
  const city = cityFromAddress(s.address);
  const dates = formatSpan(s.start_date, s.end_date);
  const repeatTag = s.repeat_claim
    ? s.repeat_verified
      ? "REPEAT BUYER"
      : "REPEAT BUYER (UNVERIFIED)"
    : "FIRST-TIMER";
  const lines = [
    s.kind === "offer" ? "NEW OFFER" : "NEW DATE REQUEST",
    "",
    `${s.venue} — ${city}`,
    dates,
    `${s.shows} show${s.shows === 1 ? "" : "s"} · Cap ${s.capacity} · Tickets ${money(s.ticket_price)}`,
    repeatTag,
    "",
    `Engine quote: ${money(s.quote.guarantee)} vs ${s.quote.doorPct}%`,
  ];
  if (s.kind === "offer" && s.offer) {
    lines.push(
      `Their offer: ${money(s.offer.guarantee)}` +
        (s.offer.doorPct ? ` vs ${s.offer.doorPct}%` : "") +
        (s.offer.travel ? ` + ${money(s.offer.travel)} travel` : "") +
        ` · Hotel: ${s.offer.hotel ? "yes" : "no"}`
    );
  }
  lines.push(
    `Walkout potential: ${money(s.quote.walkoutPotential)}`,
    "",
    `Buyer: ${s.buyer_name}`,
    `Contact: ${s.buyer_email} ${s.buyer_phone}`,
    "",
    `Review: ${baseUrl()}/office?item=${s.id}`
  );
  await sendMail({
    to,
    subject: `[Booking] ${s.venue} — ${city} — ${dates}`,
    text: lines.join("\n"),
  });
}

// 2. John taps Accept → Peter gets the deal sheet.
export async function sendDealSheet(cfg: EngineConfig, s: SubmissionRecord): Promise<void> {
  const to = process.env.PETER_EMAIL || process.env.BOOKING_NOTIFY_EMAIL;
  if (!to) return;
  const city = cityFromAddress(s.address);
  const dates = formatSpan(s.start_date, s.end_date);
  // On an accepted offer the agreed terms are the buyer's terms.
  const agreed =
    s.kind === "offer" && s.offer
      ? [
          `FEE: ${money(s.offer.guarantee)} Guarantee` +
            (s.offer.doorPct
              ? ` vs ${s.offer.doorPct}% of gross box office receipts, whichever is greater`
              : ""),
          `+ ${money(s.quote.selloutBonus)} per sellout`,
          ...(s.offer.travel ? [`${money(s.offer.travel)} travel buyout`] : []),
          s.offer.hotel
            ? "Hotel provided by purchaser. No comps without Artist approval."
            : "No hotel included — confirm lodging. No comps without Artist approval.",
          ...(s.shows >= 4 ? ["Thursday arrival for press"] : []),
          ...(s.quote.depositPct > 0
            ? [
                `${s.quote.depositPct}% deposit due ${s.quote.depositDueHours} hours after contract — first-time buyer`,
              ]
            : []),
        ]
      : termsLines(cfg, s);
  const text = [
    `JH — ${s.venue} — ${city}`,
    dates,
    `${s.shows} Show${s.shows === 1 ? "" : "s"}`,
    ...agreed,
    `Cap ${s.capacity} · Tickets ${money(s.ticket_price)}`,
    `Buyer: ${s.buyer_name} / ${s.venue}`,
    `Contact: ${s.buyer_email} ${s.buyer_phone}`,
    `Source: Booking app — terms accepted ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");
  await sendMail({
    to,
    subject: `JH — ${s.venue} — ${city} — ${dates}`,
    text,
  });
}

// 3. Buyer confirmation on acceptance.
export async function sendBuyerAcceptance(s: SubmissionRecord): Promise<void> {
  const dates = formatSpan(s.start_date, s.end_date);
  await sendMail({
    to: s.buyer_email,
    subject: `John Heffron — ${s.venue} — ${dates} — Terms confirmed`,
    text: [
      `${s.buyer_name},`,
      "",
      `Terms confirmed pending contract for John Heffron at ${s.venue}, ${dates}.`,
      "Contract to follow from John's management.",
      "",
      "— The Office of John Heffron",
    ].join("\n"),
  });
}

// Counter with the engine quote — the standard memo, emailed back.
export async function sendCounterMemo(cfg: EngineConfig, s: SubmissionRecord): Promise<void> {
  const dates = formatSpan(s.start_date, s.end_date);
  await sendMail({
    to: s.buyer_email,
    subject: `John Heffron — ${s.venue} — ${dates} — Standard terms`,
    text: [
      `${s.buyer_name},`,
      "",
      "The office has reviewed your offer. The standard terms for this",
      "engagement are set out below and remain available.",
      "",
      "DEAL MEMO",
      `${s.venue} — ${cityFromAddress(s.address)}`,
      dates,
      `${s.shows} Show${s.shows === 1 ? "" : "s"}`,
      ...termsLines(cfg, s),
      "",
      "Full settlement terms in contract. Reply to this email to confirm.",
      "",
      "— The Office of John Heffron",
    ].join("\n"),
  });
}

export async function sendBuyerDecline(s: SubmissionRecord): Promise<void> {
  const dates = formatSpan(s.start_date, s.end_date);
  await sendMail({
    to: s.buyer_email,
    subject: `John Heffron — ${s.venue} — ${dates}`,
    text: [
      `${s.buyer_name},`,
      "",
      `The office is unable to confirm ${dates} for ${s.venue} at this time.`,
      "We appreciate the interest and would welcome a future inquiry.",
      "",
      "— The Office of John Heffron",
    ].join("\n"),
  });
}

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  return sendMail({
    to: email,
    subject: "Your verification code — The Office of John Heffron",
    text: [
      `Your verification code is ${code}.`,
      "It expires in 15 minutes.",
      "",
      "— The Office of John Heffron",
    ].join("\n"),
  });
}

export async function sendCorporateInquiry(fields: {
  name: string;
  email: string;
  phone: string;
  company: string;
  details: string;
}): Promise<void> {
  const to = process.env.BOOKING_NOTIFY_EMAIL;
  if (!to) return;
  await sendMail({
    to,
    subject: `[Booking] Corporate inquiry — ${fields.company || fields.name}`,
    text: [
      "CORPORATE / PRIVATE EVENT INQUIRY",
      "",
      `Name: ${fields.name}`,
      `Company: ${fields.company}`,
      `Contact: ${fields.email} ${fields.phone}`,
      "",
      fields.details,
    ].join("\n"),
  });
}
