export type LatLng = { lat: number; lng: number };

/** A rectangular grid of panels the user drags around on the roof. */
export type Field = {
  id: string;
  lat: number;
  lng: number;
  rows: number;
  cols: number;
  /** Direction the slope faces, in degrees: 0 = N, 90 = E, 180 = S, 270 = W. */
  rotation: number;
};

/** Panel dimensions, taken from the Solar API response when it answers. */
export type PanelSpec = {
  heightM: number;
  widthM: number;
  capacityW: number;
};

export type AddressSuggestion = {
  placeId: string;
  label: string;
};

export type SelectedAddress = AddressSuggestion & {
  lat?: number;
  lng?: number;
};

/** Only the azimuth is used, to orient the first field along the main slope. */
export type RoofSegment = {
  azimuthDegrees?: number;
};

export type SolarSource = 'api' | 'fallback' | null;
