import { NextResponse } from 'next/server';

/**
 * Reads the server-side Google key. Kept out of the client bundle on purpose:
 * every billable Google call goes through an /api route so the key is never
 * scrapeable from a public URL.
 */
export function serverKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_SERVER_KEY is not set');
  return key;
}

export function configError() {
  return NextResponse.json(
    { error: 'Configuration serveur incomplète (GOOGLE_MAPS_SERVER_KEY manquante).' },
    { status: 500 },
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function upstreamError(message: string) {
  return NextResponse.json({ error: message }, { status: 502 });
}

/**
 * Best-effort per-IP throttle so a public URL can't be turned into free Google
 * quota. In-memory, so it resets on cold start and isn't shared between
 * function instances — enough to blunt casual abuse, not a substitute for the
 * quota caps you should also set in Google Cloud Console.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, limit: number, windowMs = 60_000): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: 'Trop de requêtes. Réessayez dans une minute.' },
    { status: 429 },
  );
}
