import { NextResponse } from 'next/server';
import {
  badRequest,
  configError,
  rateLimit,
  serverKey,
  tooManyRequests,
  upstreamError,
} from '@/lib/server/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!rateLimit(req, 60)) return tooManyRequests();

  const placeId = new URL(req.url).searchParams.get('placeId');
  if (!placeId) return badRequest('placeId manquant.');

  let key: string;
  try {
    key = serverKey();
  } catch {
    return configError();
  }

  try {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json' +
      `?place_id=${encodeURIComponent(placeId)}&language=fr&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();

    const loc = data?.results?.[0]?.geometry?.location;
    if (data.status !== 'OK' || !loc) {
      return upstreamError(data?.error_message || `Géocodage impossible (${data.status}).`);
    }

    return NextResponse.json({ lat: loc.lat, lng: loc.lng });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : 'Geocoding API injoignable.');
  }
}
