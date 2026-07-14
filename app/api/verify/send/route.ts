import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";

export const dynamic = "force-dynamic";

const EXPIRY_MINUTES = 15;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  // Light rate limit: at most 3 codes per email per 15 minutes.
  const { rows: recent } = await query<{ count: string }>(
    `SELECT count(*) FROM email_verifications
     WHERE email = $1 AND created_at > now() - interval '15 minutes'`,
    [email]
  );
  if (Number(recent[0]?.count || 0) >= 3) {
    return NextResponse.json(
      { error: "Too many codes requested. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await query(
    `INSERT INTO email_verifications (email, code, expires_at)
     VALUES ($1, $2, now() + interval '${EXPIRY_MINUTES} minutes')`,
    [email, code]
  );
  const delivered = await sendVerificationCode(email, code);

  // Local preview only: without an email provider, surface the code.
  const devCode =
    !delivered && process.env.NODE_ENV !== "production" ? code : undefined;
  return NextResponse.json({ sent: true, devCode });
}
