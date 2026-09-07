/**
 * Keyless tile sources used by the OSM provider. Esri's World Imagery is the
 * only free aerial layer with usable resolution over France; OpenStreetMap
 * covers the plan view on the landing screen.
 */
export const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ROADMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const SATELLITE_ATTRIBUTION =
  'Imagerie &copy; Esri, Maxar, Earthstar Geographics';

export const ROADMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Deepest zoom Esri actually serves tiles for; beyond that Leaflet upscales. */
export const SATELLITE_MAX_NATIVE_ZOOM = 19;
export const MAX_ZOOM = 21;

export function satelliteTileUrl(z: number, x: number, y: number): string {
  return SATELLITE_TILE_URL.replace('{z}', String(z))
    .replace('{y}', String(y))
    .replace('{x}', String(x));
}
