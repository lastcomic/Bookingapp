import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/settings";
import { createSessionToken, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Front door for buyers. The access code lives in engine settings, so John
// can set or rotate it from /office without a redeploy.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const cfg = await getConfig();
  const expected = (cfg.accessCode || "").trim();
  const given = String(body.code || "").trim();
  if (expected && given.toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json(
      { error: "That code was not recognized. Check with the office." },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie("site", createSessionToken("site")));
  return res;
}
