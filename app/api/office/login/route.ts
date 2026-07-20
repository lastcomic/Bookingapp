import { NextRequest, NextResponse } from "next/server";
import {
  checkPassword,
  checkManagerPassword,
  createSessionToken,
  sessionCookie,
} from "@/lib/auth";
import { getConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const password = String(body.password || "");

  // Either the owner password (env) or the manager password (settings) works.
  let ok = checkPassword(password);
  if (!ok) {
    const cfg = await getConfig();
    ok = checkManagerPassword(password, cfg.managerPassword);
  }
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie("office", createSessionToken("office")));
  return res;
}
