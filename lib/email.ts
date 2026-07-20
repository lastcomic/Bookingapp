// Transactional email. Prefers plain SMTP (works with a Gmail app password —
// SMTP_USER/SMTP_PASS), falls back to the Resend API if RESEND_API_KEY is
// set, and logs to the server console when neither is configured.

import nodemailer from "nodemailer";
import { EngineConfig, EngineQuote, OfferTerms } from "@/lib/engine";
import { formatSpan } from "@/lib/dates";

type Mail = { to: string; subject: string; text: string };

// Tolerant of copy/paste artifacts: Gmail shows app passwords with spaces,
// and values sometimes arrive with stray whitespace or wrapping quotes.
function clean(value: string | undefined, fallback = ""): string {
  return (value || fallback).trim().replace(/^["']|["']$/g, "").trim();
}

export function smtpTransport() {
  const port = Number(clean(process.env.SMTP_PORT, "465"));
  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST, "smtp.gmail.com"),
    port,
    secure: port === 465,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: clean(process.env.SMTP_PASS).replace(/\s+/g, ""),
    },
  });
}

async function sendViaSmtp(mail: Mail, from: string): Promise<boolean> {
  await smtpTransport().sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
  return true;
}

async function sendViaResend(mail: Mail, from: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  return true;
}

export async function sendMail(mail: Mail): Promise<boolean> {
  const from =
    process.env.EMAIL_FROM ||
    (process.env.SMTP_USER
      ? `The Office of John Heffron <${process.env.SMTP_USER}>`
      : "The Office <office@example.com>");
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return await sendViaSmtp(mail, from);
    }
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(mail, from);
    }
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
  console.log(`[email:dev] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
  return false;
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
    `${s.shows} show${s.shows === 1 ? "" : "s"} · Cap ${s.capacity}${
      s.ticket_price > 0 ? ` · Tickets ${money(s.ticket_price)}` : ""
    }`,
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
    if (s.offer.bonus) {
      lines.push(
        `Bonus: ${money(s.offer.bonus)}` +
          (s.offer.bonusTerms ? ` ${s.offer.bonusTerms}` : "")
      );
    }
    if (s.offer.notes) lines.push(`Note: ${s.offer.notes}`);
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
          ...(s.offer.bonus
            ? [
                `${money(s.offer.bonus)} bonus${
                  s.offer.bonusTerms ? ` ${s.offer.bonusTerms}` : ""
                }`,
              ]
            : []),
          s.offer.hotel
            ? "Hotel provided by purchaser. No comps without Artist approval."
            : "No hotel included — confirm lodging. No comps without Artist approval.",
          ...(s.shows >= 4 ? ["Thursday arrival for press"] : []),
          ...(s.offer.notes ? [`Buyer note: ${s.offer.notes}`] : []),
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
    `Cap ${s.capacity}${s.ticket_price > 0 ? ` · Tickets ${money(s.ticket_price)}` : ""}`,
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

export type CounterTerms = {
  guarantee: number;
  doorPct: number;
  travel: number;
  hotel: boolean;
  bonus?: number;
  bonusTerms?: string;
  message?: string;
};

// Custom counter — John's own revised terms, emailed straight to the buyer.
// No agent in the middle.
export async function sendCustomCounter(
  s: SubmissionRecord,
  counter: CounterTerms
): Promise<void> {
  const dates = formatSpan(s.start_date, s.end_date);
  const terms = [
    `${money(counter.guarantee)} Guarantee vs ${counter.doorPct}% of gross box office receipts, whichever is greater`,
  ];
  if (counter.travel > 0) terms.push(`${money(counter.travel)} travel buyout`);
  if (counter.bonus && counter.bonus > 0) {
    terms.push(
      `${money(counter.bonus)} bonus${counter.bonusTerms ? ` ${counter.bonusTerms}` : ""}`
    );
  }
  terms.push(
    counter.hotel
      ? "Hotel provided by purchaser. No comps without Artist approval."
      : "Hotel to be confirmed. No comps without Artist approval."
  );
  await sendMail({
    to: s.buyer_email,
    subject: `John Heffron — ${s.venue} — ${dates} — Revised terms`,
    text: [
      `${s.buyer_name},`,
      "",
      ...(counter.message ? [counter.message, ""] : []),
      "Revised terms:",
      `${s.venue} — ${cityFromAddress(s.address)}`,
      dates,
      `${s.shows} Show${s.shows === 1 ? "" : "s"}`,
      ...terms,
      "",
      "Reply to this email to confirm and we are set.",
      "",
      "— John Heffron",
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
