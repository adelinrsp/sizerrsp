import { NextResponse } from 'next/server';
import {
  badRequest,
  configError,
  rateLimit,
  serverKey,
  tooManyRequests,
} from '@/lib/server/google';
import { resolveProvider } from '@/lib/map/provider';

export const runtime = 'nodejs';

/**
 * Wraps Solar API `buildingInsights:findClosest`. A miss here is normal — large
 * parts of France are outside coverage — so an unavailable roof returns 200 with
 * `{ available: false }` and the client falls back to manual placement.
 *
 * There is no keyless equivalent to Solar API, so the OSM stack always reports
 * unavailable and the whole app runs on that same manual path.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 30)) return tooManyRequests();

  if (resolveProvider() === 'osm') {
    return NextResponse.json({
      available: false,
      reason: 'Analyse de toit indisponible sans Google Solar API.',
    });
  }

  const params = new URL(req.url).searchParams;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return badRequest('Coordonnées invalides.');
  }

  let key: string;
  try {
    key = serverKey();
  } catch {
    return configError();
  }

  try {
    const url =
      'https://solar.googleapis.com/v1/buildingInsights:findClosest' +
      `?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();

    const sp = data?.solarPotential;
    if (!res.ok || !sp) {
      return NextResponse.json({
        available: false,
        reason: data?.error?.message || 'Adresse hors couverture Solar API.',
      });
    }

    const panels = sp.solarPanels || [];
    const avgPanelEnergy = panels.length
      ? panels.reduce(
          (sum: number, p: { yearlyEnergyDcKwh?: number }) => sum + (p.yearlyEnergyDcKwh || 0),
          0,
        ) / panels.length
      : 0;

    // Panel dimensions are deliberately not forwarded: the module we install is
    // fixed (see DEFAULT_PANEL_SPEC), so Solar API's own geometry is ignored.
    return NextResponse.json({
      available: true,
      maxArrayPanelsCount: sp.maxArrayPanelsCount ?? panels.length,
      avgPanelEnergy,
      roofSegments: (sp.roofSegmentStats || []).map((seg: { azimuthDegrees?: number }) => ({
        azimuthDegrees: seg.azimuthDegrees,
      })),
    });
  } catch (e) {
    return NextResponse.json({
      available: false,
      reason: e instanceof Error ? e.message : 'Solar API injoignable.',
    });
  }
}
