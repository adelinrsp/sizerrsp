import { NextResponse } from 'next/server';
import { badRequest, configError, rateLimit, serverKey, tooManyRequests } from '@/lib/server/google';
import { fieldOutline, fieldPanelCorners, totalPanels } from '@/lib/geo';
import { resolveProvider } from '@/lib/map/provider';
import type { Field, LatLng, PanelSpec } from '@/lib/types';

export const runtime = 'nodejs';

/** Above this count the individual panels are unreadable, so we outline each field instead. */
const PANEL_DETAIL_LIMIT = 60;
/** Static Maps rejects URLs beyond ~16k characters. */
const MAX_URL_LENGTH = 16000;

const f6 = (n: number) => n.toFixed(6);

const encodePath = (corners: LatLng[], weight: number) =>
  'path=fillcolor:0xFFBE00CC%7Ccolor:0x001D3DFF%7C' +
  `weight:${weight}%7C` +
  corners
    .concat([corners[0]])
    .map((p) => `${f6(p.lat)},${f6(p.lng)}`)
    .join('%7C');

type Body = {
  center?: LatLng;
  zoom?: number;
  fields?: Field[];
  panelSpec?: PanelSpec;
};

export async function POST(req: Request) {
  if (!rateLimit(req, 20)) return tooManyRequests();

  // The OSM stack composes its PNG in the browser instead; see lib/export.
  if (resolveProvider() === 'osm') {
    return badRequest('Export Static Maps indisponible hors du provider Google.');
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Corps de requête invalide.');
  }

  const { center, zoom, fields, panelSpec } = body;
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    return badRequest('Centre de carte manquant.');
  }
  if (!Number.isFinite(zoom)) return badRequest('Zoom manquant.');
  if (!fields?.length) return badRequest('Aucun champ de panneaux à exporter.');
  if (!panelSpec) return badRequest('Dimensions de panneau manquantes.');

  let key: string;
  try {
    key = serverKey();
  } catch {
    return configError();
  }

  const detailed = totalPanels(fields) <= PANEL_DETAIL_LIMIT;
  const paths = detailed
    ? fields.flatMap((field) =>
        fieldPanelCorners(field, panelSpec).map((corners) => encodePath(corners, 1)),
      )
    : fields.map((field) => encodePath(fieldOutline(field, panelSpec), 2));

  const url =
    'https://maps.googleapis.com/maps/api/staticmap' +
    `?center=${f6(center.lat)},${f6(center.lng)}` +
    `&zoom=${Math.round(zoom as number)}&size=640x640&scale=2&maptype=satellite` +
    `&${paths.join('&')}&key=${key}`;

  if (url.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: 'Plan trop détaillé pour l’export. Réduisez le nombre de champs.' },
      { status: 413 },
    );
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Google's own message is long and in English; only fall back to it when
      // we have nothing more actionable to say.
      const message =
        res.status === 403
          ? 'Export refusé : activez « Maps Static API » sur votre clé Google Cloud.'
          : `Google a refusé l’export (${res.status}). ${(await res.text()).slice(0, 120)}`.trim();
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Maps Static API injoignable.' },
      { status: 502 },
    );
  }
}
