import { NextResponse } from 'next/server';
import { rateLimit, tooManyRequests } from '@/lib/server/google';
import { SATELLITE_MAX_NATIVE_ZOOM, satelliteTileUrl } from '@/lib/map/tiles';

export const runtime = 'nodejs';

/**
 * Same-origin proxy for the aerial tiles, used only by the PNG export: drawing
 * a cross-origin image would taint the canvas and block `toBlob`. The live map
 * loads its tiles straight from the source.
 */
export async function GET(req: Request) {
  if (!rateLimit(req, 600)) return tooManyRequests();

  const params = new URL(req.url).searchParams;
  const z = Number(params.get('z'));
  const x = Number(params.get('x'));
  const y = Number(params.get('y'));

  const valid =
    Number.isInteger(z) &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    z >= 0 &&
    z <= SATELLITE_MAX_NATIVE_ZOOM &&
    x >= 0 &&
    y >= 0 &&
    x < 2 ** z &&
    y < 2 ** z;

  if (!valid) {
    return NextResponse.json({ error: 'Coordonnées de tuile invalides.' }, { status: 400 });
  }

  try {
    const res = await fetch(satelliteTileUrl(z, x, y));
    if (!res.ok) {
      return NextResponse.json(
        { error: `Tuile indisponible (${res.status}).` },
        { status: 502 },
      );
    }

    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Serveur de tuiles injoignable.' },
      { status: 502 },
    );
  }
}
