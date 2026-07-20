import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_DAYS = 30;

// Two separate doors: "office" (John, via ADMIN_PASSWORD) and "site"
// (buyers, via the access code in engine settings). Tokens are scoped so
// one cookie can never open the other door.
type Scope = "office" | "site";

const COOKIE_NAMES: Record<Scope, string> = {
  office: "office_session",
  site: "site_session",
};

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Set ADMIN_PASSWORD (and optionally SESSION_SECRET).");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}

// A second, John-settable login (the manager password from engine settings).
export function checkManagerPassword(password: string, managerPassword: string): boolean {
  const expected = (managerPassword || "").trim();
  if (!expected) return false;
  return safeEqual(password.trim(), expected);
}

export function createSessionToken(scope: Scope): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${exp}.${sign(`${scope}:${exp}`)}`;
}

export function verifySessionToken(scope: Scope, token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`${scope}:${exp}`));
}

function isAuthed(scope: Scope): boolean {
  try {
    return verifySessionToken(scope, cookies().get(COOKIE_NAMES[scope])?.value);
  } catch {
    return false;
  }
}

export function isOfficeAuthed(): boolean {
  return isAuthed("office");
}

export function isSiteAuthed(): boolean {
  return isAuthed("site");
}

export function sessionCookie(scope: Scope, token: string) {
  return {
    name: COOKIE_NAMES[scope],
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}
