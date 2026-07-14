import { query } from "@/lib/db";
import { DEFAULT_CONFIG, EngineConfig } from "@/lib/engine";

export const ARTIST_ID = "john-heffron";

export async function getConfig(): Promise<EngineConfig> {
  try {
    const { rows } = await query<{ config: Partial<EngineConfig> }>(
      "SELECT config FROM settings WHERE artist_id = $1",
      [ARTIST_ID]
    );
    if (rows.length === 0) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...rows[0].config };
  } catch {
    // No database (e.g. local preview) — run on defaults.
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: EngineConfig): Promise<void> {
  await query(
    `INSERT INTO settings (artist_id, config, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (artist_id) DO UPDATE SET config = $2, updated_at = now()`,
    [ARTIST_ID, JSON.stringify(config)]
  );
}
