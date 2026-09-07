import { NextResponse } from 'next/server';
import { banAutocomplete } from '@/lib/server/ban';
import {
  configError,
  rateLimit,
  serverKey,
  tooManyRequests,
  upstreamError,
} from '@/lib/server/google';
import { resolveProvider } from '@/lib/map/provider';
import type { AddressSuggestion } from '@/lib/types';

export const runtime = 'nodejs';

type PlacePrediction = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
  };
};

export async function GET(req: Request) {
  if (!rateLimit(req, 60)) return tooManyRequests();

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });

  if (resolveProvider() === 'osm') {
    try {
      return NextResponse.json({ suggestions: await banAutocomplete(q) });
    } catch (e) {
      return upstreamError(e instanceof Error ? e.message : 'API Adresse injoignable.');
    }
  }

  let key: string;
  try {
    key = serverKey();
  } catch {
    return configError();
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.text,suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ['fr'],
        languageCode: 'fr',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return upstreamError(data?.error?.message || 'Places API a refusé la requête.');
    }

    const suggestions: AddressSuggestion[] = (data.suggestions || [])
      .map((s: PlacePrediction) => ({
        placeId: s.placePrediction?.placeId || '',
        label: s.placePrediction?.text?.text || '',
      }))
      .filter((s: AddressSuggestion) => s.placeId && s.label)
      .slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : 'Places API injoignable.');
  }
}
