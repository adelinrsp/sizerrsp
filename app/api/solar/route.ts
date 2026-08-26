import { NextResponse } from 'next/server';
import {
  badRequest,
  configError,
  rateLimit,
  serverKey,
  tooManyRequests,
} from '@/lib/server/google';

export const runtime = 'nodejs';

/**
 * Wraps Solar API `buildingInsights:findClosest`. A miss here is normal — large
 * parts of France are outside coverage — so an unavailable roof returns 200 with
 * `{ available: false }` and the client falls back to manual placement.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 30)) return tooManyRequests();

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

    return NextResponse.json({
      available: true,
      panelHeightMeters: sp.panelHeightMeters ?? null,
      panelWidthMeters: sp.panelWidthMeters ?? null,
      panelCapacityWatts: sp.panelCapacityWatts ?? null,
      maxArrayPanelsCount: sp.maxArrayPanelsCount ?? panels.length,
      avgPanelEnergy,
      roofSegments: (sp.roofSegmentStats || []).map(
        (seg: { azimuthDegrees?: number; boundingBox?: unknown }) => ({
          azimuthDegrees: seg.azimuthDegrees,
          boundingBox: seg.boundingBox,
        }),
      ),
    });
  } catch (e) {
    return NextResponse.json({
      available: false,
      reason: e instanceof Error ? e.message : 'Solar API injoignable.',
    });
  }
}
