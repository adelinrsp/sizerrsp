import { loadGoogleMaps } from '../mapsLoader';
import { ROADMAP_STYLE } from '../mapStyle';
import type { LatLng } from '../types';
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

function symbolFor(icon: IconSpec): google.maps.Symbol {
  if (icon.kind === 'arrow') {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 4.5,
      rotation: icon.rotation,
      fillColor: icon.fill,
      fillOpacity: 1,
      strokeColor: icon.stroke,
      strokeWeight: icon.strokeWidth,
    };
  }
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: icon.radius,
    fillColor: icon.fill,
    fillOpacity: 1,
    strokeColor: icon.stroke,
    strokeWeight: icon.strokeWidth,
  };
}

function labelFor(icon: IconSpec): google.maps.MarkerLabel | undefined {
  if (icon.kind !== 'circle' || !icon.label) return undefined;
  return {
    text: icon.label.text,
    color: icon.label.color,
    fontSize: '13px',
    fontWeight: '700',
  };
}

class GoogleMarker implements MarkerHandle {
  constructor(
    private marker: google.maps.Marker,
    private map: google.maps.Map,
  ) {}

  setPosition(position: LatLng) {
    this.marker.setPosition(position);
  }

  getPosition(): LatLng | null {
    const pos = this.marker.getPosition();
    return pos ? { lat: pos.lat(), lng: pos.lng() } : null;
  }

  setIcon(icon: IconSpec) {
    this.marker.setIcon(symbolFor(icon));
    const label = labelFor(icon);
    if (label) this.marker.setLabel(label);
  }

  setVisible(visible: boolean) {
    this.marker.setMap(visible ? this.map : null);
  }

  remove() {
    this.marker.setMap(null);
  }
}

class GooglePolygon implements PolygonHandle {
  constructor(private polygon: google.maps.Polygon) {}

  remove() {
    this.polygon.setMap(null);
  }
}

class GoogleMapHandle implements MapHandle {
  constructor(private map: google.maps.Map) {}

  setBasemap(id: BasemapId) {
    this.map.setMapTypeId(id === 'satellite' ? 'satellite' : 'roadmap');
  }

  setZoom(zoom: number) {
    this.map.setZoom(zoom);
  }

  getZoom() {
    return this.map.getZoom() ?? 0;
  }

  getCenter(): LatLng | null {
    const c = this.map.getCenter();
    return c ? { lat: c.lat(), lng: c.lng() } : null;
  }

  panTo(position: LatLng) {
    this.map.panTo(position);
  }

  panBy(dx: number, dy: number) {
    this.map.panBy(dx, dy);
  }

  addMarker(options: MarkerOptions): MarkerHandle {
    const marker = new google.maps.Marker({
      position: options.position,
      map: this.map,
      draggable: options.draggable ?? false,
      zIndex: options.zIndex,
      icon: symbolFor(options.icon),
      label: labelFor(options.icon),
      cursor: options.cursor,
    });

    if (options.onDrag) {
      marker.addListener('drag', () => {
        const pos = marker.getPosition();
        if (pos) options.onDrag?.({ lat: pos.lat(), lng: pos.lng() });
      });
    }
    if (options.onDragEnd) marker.addListener('dragend', () => options.onDragEnd?.());
    if (options.onClick) marker.addListener('click', () => options.onClick?.());

    return new GoogleMarker(marker, this.map);
  }

  addPolygon(options: PolygonOptions): PolygonHandle {
    const polygon = new google.maps.Polygon({
      paths: options.paths,
      strokeColor: options.strokeColor,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      map: this.map,
      clickable: Boolean(options.onClick),
      zIndex: 3,
    });
    if (options.onClick) polygon.addListener('click', () => options.onClick?.());
    return new GooglePolygon(polygon);
  }

  destroy() {
    // Maps JavaScript API has no teardown call; dropping the reference and
    // clearing the container is all it offers.
    google.maps.event.clearInstanceListeners(this.map);
    this.map.getDiv().replaceChildren();
  }
}

export const googleProvider: MapProvider = {
  id: 'google',
  async createMap(element, options) {
    const maps = await loadGoogleMaps();
    const map = new maps.Map(element, {
      center: options.center,
      zoom: options.zoom,
      mapTypeId: options.basemap === 'satellite' ? 'satellite' : 'roadmap',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
      gestureHandling: 'greedy',
      styles: ROADMAP_STYLE,
    });
    return new GoogleMapHandle(map);
  },
};
