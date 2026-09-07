import { NextResponse } from 'next/server';
import {
  badRequest,
  configError,
  rateLimit,
  serverKey,
  tooManyRequests,
  upstreamError,
} from '@/lib/server/google';
import { resolveProvider } from '@/lib/map/provider';

export const runtime = 'nodejs';

/**
 * Resolves a Google place id to coordinates. Unused by the OSM stack, where the
 * BAN already returns coordinates alongside each suggestion.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 60)) return tooManyRequests();

  if (resolveProvider() === 'osm') {
    return badRequest('Géocodage inutile : les suggestions portent déjà leurs coordonnées.');
  }

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
