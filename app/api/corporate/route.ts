import { NextRequest, NextResponse } from "next/server";
import { sendCorporateInquiry } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const company = String(body.company || "").trim();
  const details = String(body.details || "").trim().slice(0, 5000);
  if (!name || !email || !details) {
    return NextResponse.json(
      { error: "Name, email, and event details are required" },
      { status: 400 }
    );
  }
  await sendCorporateInquiry({ name, email, phone, company, details });
  return NextResponse.json({
    submitted: true,
    message: "The office reviews all inquiries and responds within 48 hours.",
  });
}
