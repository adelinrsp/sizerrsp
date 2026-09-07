import 'leaflet/dist/leaflet.css';
import type * as L from 'leaflet';
import type { LatLng } from '../types';
import {
  MAX_ZOOM,
  ROADMAP_ATTRIBUTION,
  ROADMAP_TILE_URL,
  SATELLITE_ATTRIBUTION,
  SATELLITE_MAX_NATIVE_ZOOM,
  SATELLITE_TILE_URL,
} from './tiles';
import type {
  BasemapId,
  IconSpec,
  MapHandle,
  MapProvider,
  MarkerHandle,
  MarkerOptions,
  PolygonHandle,
  PolygonOptions,
} from './types';

/**
 * Inline SVG standing in for a Google `Symbol`. The arrow is wrapped in a
 * rotatable span so a bearing change during a drag is a CSS transform rather
 * than a full `setIcon`, which would tear down Leaflet's drag handler.
 */
function iconHtml(icon: IconSpec): { html: string; size: number } {
  if (icon.kind === 'arrow') {
    const size = 26;
    return {
      size,
      html:
        `<span data-ss-arrow style="display:block;width:${size}px;height:${size}px;` +
        `transform:rotate(${icon.rotation}deg)">` +
        `<svg width="${size}" height="${size}" viewBox="0 0 26 26">` +
        `<path d="M13 4 L20 20 L13 16.5 L6 20 Z" fill="${icon.fill}" ` +
        `stroke="${icon.stroke}" stroke-width="${icon.strokeWidth}" stroke-linejoin="round"/>` +
        `</svg></span>`,
    };
  }

  const size = Math.ceil((icon.radius + icon.strokeWidth) * 2);
  const c = size / 2;
  const label = icon.label
    ? `<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" ` +
      `font-size="13" font-weight="700" font-family="system-ui,sans-serif" ` +
      `fill="${icon.label.color}">${icon.label.text}</text>`
    : '';

  return {
    size,
    html:
      `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${icon.radius}" fill="${icon.fill}" ` +
      `stroke="${icon.stroke}" stroke-width="${icon.strokeWidth}"/>${label}</svg>`,
  };
}

function buildIcon(lib: typeof L, icon: IconSpec): L.DivIcon {
  const { html, size } = iconHtml(icon);
  return lib.divIcon({
    html,
    className: 'ss-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

class LeafletMarker implements MarkerHandle {
  private attached = true;

  constructor(
    private lib: typeof L,
    private marker: L.Marker,
    private map: L.Map,
  ) {}

  setPosition(position: LatLng) {
    this.marker.setLatLng(position);
  }

  getPosition(): LatLng | null {
    const p = this.marker.getLatLng();
    return { lat: p.lat, lng: p.lng };
  }

  setIcon(icon: IconSpec) {
    if (icon.kind === 'arrow') {
      const inner = this.marker.getElement()?.querySelector<HTMLElement>('[data-ss-arrow]');
      if (inner) {
        inner.style.transform = `rotate(${icon.rotation}deg)`;
        return;
      }
    }
    this.marker.setIcon(buildIcon(this.lib, icon));
  }

  setVisible(visible: boolean) {
    if (visible === this.attached) return;
    this.attached = visible;
    if (visible) this.marker.addTo(this.map);
    else this.marker.remove();
  }

  remove() {
    this.marker.remove();
    this.attached = false;
  }
}

class LeafletPolygon implements PolygonHandle {
  constructor(private polygon: L.Polygon) {}

  remove() {
    this.polygon.remove();
  }
}

class LeafletMapHandle implements MapHandle {
  private basemap: BasemapId;

  constructor(
    private lib: typeof L,
    private map: L.Map,
    private layers: Record<BasemapId, L.TileLayer>,
    initial: BasemapId,
  ) {
    this.basemap = initial;
  }

  setBasemap(id: BasemapId) {
    if (id === this.basemap) return;
    this.layers[this.basemap].remove();
    this.layers[id].addTo(this.map);
    // Keep imagery under the panel polygons, which live in the overlay pane.
    this.layers[id].bringToBack();
    this.basemap = id;
  }

  setZoom(zoom: number) {
    this.map.setZoom(zoom);
  }

  getZoom() {
    return this.map.getZoom();
  }

  getCenter(): LatLng | null {
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  panTo(position: LatLng) {
    this.map.panTo(position);
  }

  panBy(dx: number, dy: number) {
    this.map.panBy([dx, dy]);
  }

  addMarker(options: MarkerOptions): MarkerHandle {
    const marker = this.lib
      .marker(options.position, {
        draggable: options.draggable ?? false,
        icon: buildIcon(this.lib, options.icon),
        zIndexOffset: (options.zIndex ?? 0) * 100,
        keyboard: false,
      })
      .addTo(this.map);

    if (options.cursor) {
      const el = marker.getElement();
      if (el) el.style.cursor = options.cursor;
    }

    if (options.onDrag) {
      marker.on('drag', () => {
        const p = marker.getLatLng();
        options.onDrag?.({ lat: p.lat, lng: p.lng });
      });
    }
    if (options.onDragEnd) marker.on('dragend', () => options.onDragEnd?.());
    if (options.onClick) {
      marker.on('click', (e) => {
        this.lib.DomEvent.stopPropagation(e);
        options.onClick?.();
      });
    }

    return new LeafletMarker(this.lib, marker, this.map);
  }

  addPolygon(options: PolygonOptions): PolygonHandle {
    const polygon = this.lib
      .polygon(options.paths, {
        color: options.strokeColor,
        weight: options.strokeWeight,
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
        interactive: Boolean(options.onClick),
      })
      .addTo(this.map);

    if (options.onClick) {
      polygon.on('click', (e) => {
        this.lib.DomEvent.stopPropagation(e);
        options.onClick?.();
      });
    }

    return new LeafletPolygon(polygon);
  }

  destroy() {
    this.map.remove();
  }
}

export const leafletProvider: MapProvider = {
  id: 'osm',
  async createMap(element, options) {
    const lib = (await import('leaflet')).default;

    const map = lib.map(element, {
      center: options.center,
      zoom: options.zoom,
      zoomControl: false,
      attributionControl: true,
      maxZoom: MAX_ZOOM,
      // Hundreds of panel polygons at once: the canvas renderer keeps dragging
      // smooth where one SVG node per panel would not.
      preferCanvas: true,
    });

    lib.control.zoom({ position: 'bottomright' }).addTo(map);

    const layers: Record<BasemapId, L.TileLayer> = {
      roadmap: lib.tileLayer(ROADMAP_TILE_URL, {
        maxZoom: MAX_ZOOM,
        maxNativeZoom: 19,
        attribution: ROADMAP_ATTRIBUTION,
      }),
      satellite: lib.tileLayer(SATELLITE_TILE_URL, {
        maxZoom: MAX_ZOOM,
        maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
        attribution: SATELLITE_ATTRIBUTION,
      }),
    };
    layers[options.basemap].addTo(map);

    return new LeafletMapHandle(lib, map, layers, options.basemap);
  },
};
