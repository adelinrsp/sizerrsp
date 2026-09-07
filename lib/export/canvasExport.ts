import { fieldOutline, fieldPanelCorners, totalPanels } from '../geo';
import { SATELLITE_ATTRIBUTION, SATELLITE_MAX_NATIVE_ZOOM } from '../map/tiles';
import type { Field, LatLng, PanelSpec } from '../types';

/** Same threshold as the Google export: past this, panels blur into a block. */
const PANEL_DETAIL_LIMIT = 60;
const OUT_SIZE = 1280;
const TILE_SIZE = 256;

/** Web Mercator, pixel coordinates at a given zoom. */
function project(pos: LatLng, zoom: number) {
  const world = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((pos.lat * Math.PI) / 180);
  return {
    x: ((pos.lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * world,
  };
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // A missing tile leaves a gap rather than failing the whole export.
    img.onerror = () => resolve(null);
    img.src = `/api/tiles?z=${z}&x=${x}&y=${y}`;
  });
}

/**
 * Builds the roof plan client-side: aerial tiles proxied through `/api/tiles`
 * (so the canvas stays untainted), then the panel geometry on top. This is the
 * keyless counterpart to the Maps Static API export.
 */
export async function exportPlanPng(options: {
  center: LatLng;
  zoom: number;
  fields: Field[];
  panelSpec: PanelSpec;
}): Promise<Blob> {
  const { center, fields, panelSpec } = options;

  // +1 mirrors the Static Maps `scale=2` framing: same ground area, twice the pixels.
  const outZoom = Math.round(options.zoom) + 1;
  const tileZoom = Math.min(outZoom, SATELLITE_MAX_NATIVE_ZOOM);
  const scale = 2 ** (outZoom - tileZoom);
  const drawnTile = TILE_SIZE * scale;

  const c = project(center, outZoom);
  const originX = c.x - OUT_SIZE / 2;
  const originY = c.y - OUT_SIZE / 2;

  const canvas = document.createElement('canvas');
  canvas.width = OUT_SIZE;
  canvas.height = OUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible dans ce navigateur.');

  ctx.fillStyle = '#0b1b2b';
  ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

  const maxIndex = 2 ** tileZoom;
  const firstX = Math.floor(originX / drawnTile);
  const lastX = Math.floor((originX + OUT_SIZE - 1) / drawnTile);
  const firstY = Math.floor(originY / drawnTile);
  const lastY = Math.floor((originY + OUT_SIZE - 1) / drawnTile);

  const jobs: Promise<void>[] = [];
  for (let tx = firstX; tx <= lastX; tx++) {
    for (let ty = firstY; ty <= lastY; ty++) {
      if (tx < 0 || ty < 0 || tx >= maxIndex || ty >= maxIndex) continue;
      const dx = tx * drawnTile - originX;
      const dy = ty * drawnTile - originY;
      jobs.push(
        loadTile(tileZoom, tx, ty).then((img) => {
          if (img) ctx.drawImage(img, dx, dy, drawnTile, drawnTile);
        }),
      );
    }
  }
  await Promise.all(jobs);

  const detailed = totalPanels(fields) <= PANEL_DETAIL_LIMIT;
  const shapes: LatLng[][] = detailed
    ? fields.flatMap((field) => fieldPanelCorners(field, panelSpec))
    : fields.map((field) => fieldOutline(field, panelSpec));

  ctx.fillStyle = 'rgba(255,190,0,0.8)';
  ctx.strokeStyle = '#001D3D';
  ctx.lineWidth = detailed ? 1 : 2;
  ctx.lineJoin = 'round';

  shapes.forEach((corners) => {
    ctx.beginPath();
    corners.forEach((corner, i) => {
      const p = project(corner, outZoom);
      const x = p.x - originX;
      const y = p.y - originY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  const credit = SATELLITE_ATTRIBUTION.replace(/&copy;/g, '©');
  ctx.font = '16px system-ui, sans-serif';
  const width = ctx.measureText(credit).width + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(OUT_SIZE - width, OUT_SIZE - 26, width, 26);
  ctx.fillStyle = '#fff';
  ctx.fillText(credit, OUT_SIZE - width + 8, OUT_SIZE - 8);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Génération du PNG impossible.'))),
      'image/png',
    );
  });
}
