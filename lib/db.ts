import { Pool } from "pg";

// Single shared pool across hot reloads / lambda invocations.
const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
  pgReady?: Promise<void>;
};

function getPool(): Pool {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL (or POSTGRES_URL)."
    );
  }
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      max: 3,
      ssl: process.env.PGSSL_DISABLE
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return globalForDb.pgPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  artist_id TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  artist_id TEXT NOT NULL DEFAULT 'john-heffron',
  kind TEXT NOT NULL CHECK (kind IN ('request','offer')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','accepted','countered','declined','auto_declined')),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  ticket_price NUMERIC NOT NULL,
  shows INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  repeat_claim BOOLEAN NOT NULL DEFAULT false,
  repeat_verified BOOLEAN NOT NULL DEFAULT false,
  drive_minutes INTEGER,
  quote JSONB NOT NULL,
  offer JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_email_idx
  ON email_verifications (email, created_at DESC);

CREATE TABLE IF NOT EXISTS past_venues (
  id SERIAL PRIMARY KEY,
  artist_id TEXT NOT NULL DEFAULT 'john-heffron',
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_holds (
  id SERIAL PRIMARY KEY,
  artist_id TEXT NOT NULL DEFAULT 'john-heffron',
  hold_date DATE NOT NULL,
  UNIQUE (artist_id, hold_date)
);

-- Added after launch; safe to run repeatedly.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS counter JSONB;
`;

async function ensureSchema(): Promise<void> {
  if (!globalForDb.pgReady) {
    globalForDb.pgReady = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        globalForDb.pgReady = undefined;
        throw err;
      });
  }
  return globalForDb.pgReady;
}

export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<{ rows: T[] }> {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return { rows: result.rows as T[] };
}
