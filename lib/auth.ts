import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "office_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Set ADMIN_PASSWORD (and optionally SESSION_SECRET).");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${exp}.${sign(String(exp))}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isOfficeAuthed(): boolean {
  try {
    return verifySessionToken(cookies().get(COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}
