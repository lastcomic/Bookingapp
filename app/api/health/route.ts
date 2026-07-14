import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { smtpTransport } from "@/lib/email";

export const dynamic = "force-dynamic";

// Setup status: names what is configured, never values. The SMTP check
// performs a real login handshake without sending mail.
export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database =
      process.env.DATABASE_URL || process.env.POSTGRES_URL
        ? "error — connection failed"
        : "not configured";
  }

  checks.adminPassword = process.env.ADMIN_PASSWORD ? "set" : "not set";

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await smtpTransport().verify();
      checks.email = "smtp ok";
    } catch (err: any) {
      const detail = String(err?.message || err).slice(0, 160);
      checks.email = `smtp login failed — ${detail}`;
    }
  } else if (process.env.RESEND_API_KEY) {
    checks.email = "resend configured";
  } else {
    checks.email = "not configured";
  }

  checks.notifyEmail = process.env.BOOKING_NOTIFY_EMAIL ? "set" : "not set";
  checks.dealSheetEmail = process.env.PETER_EMAIL
    ? "set"
    : process.env.BOOKING_NOTIFY_EMAIL
    ? "falls back to notify email"
    : "not set";
  checks.driveTimePricing = process.env.GOOGLE_MAPS_API_KEY
    ? "on"
    : "off — all dates quote fly terms";
  checks.calendarSync = process.env.GOOGLE_CALENDAR_ID
    ? "on"
    : "off — manual holds and accepted engagements only";

  return NextResponse.json(checks);
}
