import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }
  const { rows } = await query<{ id: number }>(
    `UPDATE email_verifications
     SET verified_at = now()
     WHERE id = (
       SELECT id FROM email_verifications
       WHERE email = $1 AND code = $2 AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id`,
    [email, code]
  );
  if (rows.length === 0) {
    return NextResponse.json({ verified: false });
  }
  return NextResponse.json({ verified: true });
}
