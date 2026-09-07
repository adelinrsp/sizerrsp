import type { LatLng } from '../types';

export type ProviderId = 'google' | 'osm';

/** Muted plan for the landing screen, aerial imagery for the editor. */
export type BasemapId = 'roadmap' | 'satellite';

/**
 * The only marker looks the app needs. Kept declarative so each provider can
 * render them its own way: Google builds a `Symbol`, Leaflet an inline SVG.
 */
export type IconSpec =
  | {
      kind: 'circle';
      /** Radius in pixels. */
      radius: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
      label?: { text: string; color: string };
    }
  | {
      kind: 'arrow';
      /** Compass bearing the arrow points at, in degrees. */
      rotation: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };

export type MarkerOptions = {
  position: LatLng;
  icon: IconSpec;
  draggable?: boolean;
  cursor?: string;
  /** Higher sits on top, among markers only. */
  zIndex?: number;
  onDrag?: (position: LatLng) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
};

export type PolygonOptions = {
  paths: LatLng[];
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  onClick?: () => void;
};

export interface MarkerHandle {
  setPosition(position: LatLng): void;
  getPosition(): LatLng | null;
  setIcon(icon: IconSpec): void;
  setVisible(visible: boolean): void;
  remove(): void;
}

export interface PolygonHandle {
  remove(): void;
}

export interface MapHandle {
  setBasemap(id: BasemapId): void;
  setZoom(zoom: number): void;
  getZoom(): number;
  getCenter(): LatLng | null;
  panTo(position: LatLng): void;
  /** Shift the viewport by a pixel offset, to clear the sidebar. */
  panBy(dx: number, dy: number): void;
  addMarker(options: MarkerOptions): MarkerHandle;
  addPolygon(options: PolygonOptions): PolygonHandle;
  /**
   * Releases the map and frees its container. Leaflet refuses to initialise
   * twice on the same element, so an effect that re-runs must tear down first.
   */
  destroy(): void;
}

export interface MapProvider {
  id: ProviderId;
  createMap(
    element: HTMLElement,
    options: { center: LatLng; zoom: number; basemap: BasemapId },
  ): Promise<MapHandle>;
}
