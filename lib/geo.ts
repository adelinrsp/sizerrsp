import type { Field, LatLng, PanelSpec } from './types';

/**
 * The panel Rhône Solaire installs — the single source of truth for panel
 * geometry. Solar API reports dimensions of its own; they are ignored, because
 * a plan has to be drawn to the module that will actually be on the roof.
 * `heightM` runs along the slope.
 */
export const DEFAULT_PANEL_SPEC: PanelSpec = {
  heightM: 1.95,
  widthM: 1.13,
  capacityW: 500,
};

export const PANEL_GAP_M = 0.01;
export const MIN_GRID_SIDE = 1;
export const MAX_GRID_SIDE = 24;

const LAT_METER = 1 / 111320;
const lngMeter = (lat: number) => 1 / (111320 * Math.cos((lat * Math.PI) / 180));

/**
 * Unit vectors for a field's local frame.
 * `a*` runs along the slope (the rotation axis), `r*` runs along the ridge.
 */
function axes(rotationDeg: number) {
  const az = (rotationDeg * Math.PI) / 180;
  return {
    aLat: Math.cos(az),
    aLng: Math.sin(az),
    rLat: -Math.sin(az),
    rLng: Math.cos(az),
  };
}

/** Four corners of a single panel rectangle, rotated to match the roof azimuth. */
export function rotatedPanelCorners(
  lat: number,
  lng: number,
  heightM: number,
  widthM: number,
  azimuthDeg: number,
): LatLng[] {
  const latM = LAT_METER;
  const lngM = lngMeter(lat);
  const { aLat, aLng, rLat, rLng } = axes(azimuthDeg);
  const h = heightM / 2;
  const w = widthM / 2;
  return [
    { lat: lat + (-h * aLat - w * rLat) * latM, lng: lng + (-h * aLng - w * rLng) * lngM },
    { lat: lat + (-h * aLat + w * rLat) * latM, lng: lng + (-h * aLng + w * rLng) * lngM },
    { lat: lat + (h * aLat + w * rLat) * latM, lng: lng + (h * aLng + w * rLng) * lngM },
    { lat: lat + (h * aLat - w * rLat) * latM, lng: lng + (h * aLng - w * rLng) * lngM },
  ];
}

/** Overall footprint of a field: `gw` along the ridge, `gh` along the slope. */
export function fieldGridSize(field: Field, spec: PanelSpec) {
  return {
    gw: field.cols * spec.widthM + (field.cols - 1) * PANEL_GAP_M,
    gh: field.rows * spec.heightM + (field.rows - 1) * PANEL_GAP_M,
  };
}

/** Corner sets for every panel slot in a field's grid. */
export function fieldPanelCorners(field: Field, spec: PanelSpec): LatLng[][] {
  const { lat, lng, rows, cols, rotation } = field;
  const latM = LAT_METER;
  const lngM = lngMeter(lat);
  const { aLat, aLng, rLat, rLng } = axes(rotation);
  const { gw, gh } = fieldGridSize(field, spec);

  const list: LatLng[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offY = -gh / 2 + r * (spec.heightM + PANEL_GAP_M) + spec.heightM / 2;
      const offX = -gw / 2 + c * (spec.widthM + PANEL_GAP_M) + spec.widthM / 2;
      const cLat = lat + (offY * aLat + offX * rLat) * latM;
      const cLng = lng + (offY * aLng + offX * rLng) * lngM;
      list.push(rotatedPanelCorners(cLat, cLng, spec.heightM, spec.widthM, rotation));
    }
  }
  return list;
}

/** Offset from a field's center by `ridgeM` (perpendicular) and `slopeM` (along the axis). */
export function offsetPos(field: Field, ridgeM: number, slopeM: number): LatLng {
  const { aLat, aLng, rLat, rLng } = axes(field.rotation);
  const latM = LAT_METER;
  const lngM = lngMeter(field.lat);
  return {
    lat: field.lat + (slopeM * aLat + ridgeM * rLat) * latM,
    lng: field.lng + (slopeM * aLng + ridgeM * rLng) * lngM,
  };
}

/** The four outer corners of a field, used for the simplified export outline. */
export function fieldOutline(field: Field, spec: PanelSpec): LatLng[] {
  const { gw, gh } = fieldGridSize(field, spec);
  return [
    offsetPos(field, -gw / 2, gh / 2),
    offsetPos(field, gw / 2, gh / 2),
    offsetPos(field, gw / 2, -gh / 2),
    offsetPos(field, -gw / 2, -gh / 2),
  ];
}

/** Where the rotation arrow sits: just past the uphill edge. */
export function rotHandlePos(field: Field, spec: PanelSpec): LatLng {
  const { gh } = fieldGridSize(field, spec);
  const dist = gh / 2 + 1.3;
  const az = (field.rotation * Math.PI) / 180;
  return {
    lat: field.lat + dist * Math.cos(az) * LAT_METER,
    lng: field.lng + dist * Math.sin(az) * lngMeter(field.lat),
  };
}

/** The four +/- steppers hugging the field edges. */
export function edgeHandlePositions(field: Field, spec: PanelSpec) {
  const { gw, gh } = fieldGridSize(field, spec);
  return {
    colPlus: offsetPos(field, gw / 2 + 0.7, gh * 0.28),
    colMinus: offsetPos(field, gw / 2 + 0.7, -gh * 0.28),
    rowPlus: offsetPos(field, -gw * 0.28, -(gh / 2 + 0.7)),
    rowMinus: offsetPos(field, gw * 0.28, -(gh / 2 + 0.7)),
  };
}

/** Compass bearing from a field's center to a dragged handle, 0–359. */
export function bearingFromCenter(field: Field, pos: LatLng): number {
  const y = (pos.lat - field.lat) / LAT_METER;
  const x = (pos.lng - field.lng) / lngMeter(field.lat);
  let deg = (Math.atan2(x, y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

export const totalPanels = (fields: Field[]) =>
  fields.reduce((sum, f) => sum + f.rows * f.cols, 0);

export const clampGridSide = (n: number) =>
  Math.max(MIN_GRID_SIDE, Math.min(MAX_GRID_SIDE, n));
