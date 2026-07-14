import { NextRequest, NextResponse } from "next/server";
import { isOfficeAuthed } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/settings";
import { DEFAULT_CONFIG, EngineConfig } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ config: await getConfig() });
}

export async function PUT(req: NextRequest) {
  if (!isOfficeAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const incoming = body.config || {};
  const config: EngineConfig = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof EngineConfig)[]) {
    const value = incoming[key];
    const kind = typeof DEFAULT_CONFIG[key];
    if (kind === "number") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) (config as any)[key] = n;
    } else if (kind === "boolean") {
      if (typeof value === "boolean") (config as any)[key] = value;
    } else if (typeof value === "string" && value.trim()) {
      (config as any)[key] = value.trim();
    }
  }
  await saveConfig(config);
  return NextResponse.json({ config });
}
