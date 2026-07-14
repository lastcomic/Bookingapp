// Drive time from home base to the buyer's venue, via the Google Maps
// Distance Matrix API. Returns minutes, or null when unknown — the engine
// treats unknown as a fly date. Results are cached in memory per address.

const cache = new Map<string, { minutes: number | null; at: number }>();
const CACHE_MS = 6 * 3600 * 1000;

export async function driveMinutes(
  homeBase: string,
  destination: string
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const dest = destination.trim();
  if (!key || !dest) return null;

  const cacheKey = `${homeBase}|${dest.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.minutes;

  try {
    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${encodeURIComponent(homeBase)}` +
      `&destinations=${encodeURIComponent(dest)}` +
      `&units=imperial&key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Distance Matrix HTTP ${res.status}`);
    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];
    const minutes =
      element?.status === "OK" && element?.duration?.value
        ? Math.round(element.duration.value / 60)
        : null;
    cache.set(cacheKey, { minutes, at: Date.now() });
    return minutes;
  } catch {
    return null;
  }
}
