import {
  bearingFromCenter,
  edgeHandlePositions,
  fieldPanelCorners,
  rotHandlePos,
} from './geo';
import type { Field, PanelSpec, RoofSegment } from './types';

type Handlers = {
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onRotate: (id: string, rotation: number) => void;
  onBump: (id: string, key: 'rows' | 'cols', delta: number) => void;
};

type Layer = {
  polys: google.maps.Polygon[];
  center: google.maps.Marker;
  rotHandle: google.maps.Marker;
  steppers: Record<'colPlus' | 'colMinus' | 'rowPlus' | 'rowMinus', google.maps.Marker>;
};

/**
 * Owns every Google Maps overlay for the panel fields. React holds the field
 * data; this class holds the objects on the map and is driven imperatively so
 * dragging stays smooth (a re-render per drag frame would stutter).
 */
export class FieldLayers {
  private map: google.maps.Map;
  private spec: PanelSpec;
  private handlers: Handlers;
  private layers = new Map<string, Layer>();
  /** Mirror of the React field state, so drag handlers always see fresh values. */
  private fields = new Map<string, Field>();
  private roofPolys: google.maps.Polygon[] = [];

  constructor(map: google.maps.Map, spec: PanelSpec, handlers: Handlers) {
    this.map = map;
    this.spec = spec;
    this.handlers = handlers;
  }

  setSpec(spec: PanelSpec) {
    this.spec = spec;
    this.fields.forEach((field) => this.update(field));
  }

  drawRoofOutlines(segments: RoofSegment[]) {
    segments.forEach((seg) => {
      const bb = seg.boundingBox;
      const sw = bb?.sw ?? bb?.lo;
      const ne = bb?.ne ?? bb?.hi;
      if (!sw || !ne) return;
      this.roofPolys.push(
        new google.maps.Polygon({
          paths: [
            { lat: sw.latitude, lng: sw.longitude },
            { lat: sw.latitude, lng: ne.longitude },
            { lat: ne.latitude, lng: ne.longitude },
            { lat: ne.latitude, lng: sw.longitude },
          ],
          strokeColor: '#FFBE00',
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          fillColor: '#FFBE00',
          fillOpacity: 0.1,
          map: this.map,
          clickable: false,
          zIndex: 1,
        }),
      );
    });
  }

  add(field: Field) {
    this.fields.set(field.id, field);

    const polys = this.buildPanelPolys(field);

    const center = new google.maps.Marker({
      position: { lat: field.lat, lng: field.lng },
      map: this.map,
      draggable: true,
      zIndex: 10,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#001D3D',
        fillOpacity: 1,
        strokeColor: '#FFBE00',
        strokeWeight: 2.5,
      },
      cursor: 'move',
    });
    center.addListener('drag', () => {
      const pos = center.getPosition();
      if (pos) this.handlers.onMove(field.id, pos.lat(), pos.lng());
    });
    center.addListener('click', () => this.handlers.onSelect(field.id));

    const rotHandle = new google.maps.Marker({
      position: rotHandlePos(field, this.spec),
      map: this.map,
      draggable: true,
      zIndex: 11,
      icon: this.rotIcon(field.rotation),
      cursor: 'grab',
    });
    rotHandle.addListener('drag', () => {
      const pos = rotHandle.getPosition();
      const current = this.fields.get(field.id);
      if (!pos || !current) return;
      const rotation = bearingFromCenter(current, { lat: pos.lat(), lng: pos.lng() });
      rotHandle.setIcon(this.rotIcon(rotation));
      this.handlers.onRotate(field.id, rotation);
    });
    rotHandle.addListener('dragend', () => {
      const current = this.fields.get(field.id);
      if (current) rotHandle.setPosition(rotHandlePos(current, this.spec));
    });
    rotHandle.addListener('click', () => this.handlers.onSelect(field.id));

    const eh = edgeHandlePositions(field, this.spec);
    const makeStepper = (
      position: google.maps.LatLngLiteral,
      sign: 1 | -1,
      key: 'rows' | 'cols',
    ) => {
      const marker = new google.maps.Marker({
        position,
        map: this.map,
        zIndex: 11,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: sign > 0 ? '#FFBE00' : '#0b2a4d',
          fillOpacity: 1,
          strokeColor: '#001D3D',
          strokeWeight: 1.5,
        },
        label: {
          text: sign > 0 ? '+' : '−',
          color: sign > 0 ? '#001D3D' : '#FFBE00',
          fontSize: '13px',
          fontWeight: '700',
        },
        cursor: 'pointer',
      });
      marker.addListener('click', () => {
        this.handlers.onSelect(field.id);
        this.handlers.onBump(field.id, key, sign);
      });
      return marker;
    };

    this.layers.set(field.id, {
      polys,
      center,
      rotHandle,
      steppers: {
        colPlus: makeStepper(eh.colPlus, 1, 'cols'),
        colMinus: makeStepper(eh.colMinus, -1, 'cols'),
        rowPlus: makeStepper(eh.rowPlus, 1, 'rows'),
        rowMinus: makeStepper(eh.rowMinus, -1, 'rows'),
      },
    });
  }

  /**
   * Repositions everything for a changed field. `skipCenter` / `skipRotHandle`
   * leave the marker the user is actively dragging alone, so it doesn't fight
   * the pointer.
   */
  update(field: Field, opts: { skipCenter?: boolean; skipRotHandle?: boolean } = {}) {
    this.fields.set(field.id, field);
    const layer = this.layers.get(field.id);
    if (!layer) return;

    layer.polys.forEach((p) => p.setMap(null));
    layer.polys = this.buildPanelPolys(field);

    if (!opts.skipCenter) layer.center.setPosition({ lat: field.lat, lng: field.lng });
    if (!opts.skipRotHandle) {
      layer.rotHandle.setPosition(rotHandlePos(field, this.spec));
      layer.rotHandle.setIcon(this.rotIcon(field.rotation));
    }

    const eh = edgeHandlePositions(field, this.spec);
    layer.steppers.colPlus.setPosition(eh.colPlus);
    layer.steppers.colMinus.setPosition(eh.colMinus);
    layer.steppers.rowPlus.setPosition(eh.rowPlus);
    layer.steppers.rowMinus.setPosition(eh.rowMinus);
  }

  remove(id: string) {
    const layer = this.layers.get(id);
    if (layer) {
      layer.polys.forEach((p) => p.setMap(null));
      layer.center.setMap(null);
      layer.rotHandle.setMap(null);
      Object.values(layer.steppers).forEach((m) => m.setMap(null));
      this.layers.delete(id);
    }
    this.fields.delete(id);
  }

  clearAll() {
    this.roofPolys.forEach((p) => p.setMap(null));
    this.roofPolys = [];
    Array.from(this.layers.keys()).forEach((id) => this.remove(id));
  }

  private buildPanelPolys(field: Field) {
    return fieldPanelCorners(field, this.spec).map((corners) => {
      const poly = new google.maps.Polygon({
        paths: corners,
        strokeColor: 'rgba(0,29,61,0.5)',
        strokeWeight: 0.8,
        fillColor: '#FFBE00',
        fillOpacity: 0.85,
        map: this.map,
        clickable: true,
        zIndex: 3,
      });
      poly.addListener('click', () => this.handlers.onSelect(field.id));
      return poly;
    });
  }

  private rotIcon(rotation: number): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 4.5,
      rotation,
      fillColor: '#FFBE00',
      fillOpacity: 1,
      strokeColor: '#001D3D',
      strokeWeight: 1.5,
    };
  }
}
