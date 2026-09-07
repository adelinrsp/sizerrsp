import {
  bearingFromCenter,
  edgeHandlePositions,
  fieldPanelCorners,
  rotHandlePos,
} from './geo';
import type { IconSpec, MapHandle, MarkerHandle, PolygonHandle } from './map/types';
import type { Field, PanelSpec } from './types';

type Handlers = {
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onRotate: (id: string, rotation: number) => void;
  onBump: (id: string, key: 'rows' | 'cols', delta: number) => void;
};

type Layer = {
  polys: PolygonHandle[];
  center: MarkerHandle;
  rotHandle: MarkerHandle;
  steppers: Record<'colPlus' | 'colMinus' | 'rowPlus' | 'rowMinus', MarkerHandle>;
};

/**
 * Editing look, then the presentation look: with the handles hidden the grids
 * are drawn as real black modules, so the roof reads as it will once installed.
 */
const PANEL_STYLE = {
  editing: { fill: '#FFBE00', stroke: 'rgba(0,29,61,0.5)' },
  presenting: { fill: '#0C0F14', stroke: 'rgba(255,255,255,0.3)' },
} as const;

const rotIcon = (rotation: number): IconSpec => ({
  kind: 'arrow',
  rotation,
  fill: '#FFBE00',
  stroke: '#001D3D',
  strokeWidth: 1.5,
});

/**
 * Owns every map overlay for the panel fields. React holds the field data;
 * this class holds the objects on the map and is driven imperatively so
 * dragging stays smooth (a re-render per drag frame would stutter).
 *
 * It talks to `MapHandle` rather than a mapping library directly, so the same
 * code drives Google Maps and the keyless Leaflet stack.
 */
export class FieldLayers {
  private map: MapHandle;
  private spec: PanelSpec;
  private handlers: Handlers;
  private layers = new Map<string, Layer>();
  /** Mirror of the React field state, so drag handlers always see fresh values. */
  private fields = new Map<string, Field>();
  /** When false, the rotation arrow and +/- steppers are hidden for a clean view. */
  private handlesVisible = true;

  constructor(map: MapHandle, spec: PanelSpec, handlers: Handlers) {
    this.map = map;
    this.spec = spec;
    this.handlers = handlers;
  }

  setSpec(spec: PanelSpec) {
    this.spec = spec;
    this.fields.forEach((field) => this.update(field));
  }

  add(field: Field) {
    this.fields.set(field.id, field);

    const polys = this.buildPanelPolys(field);

    const center = this.map.addMarker({
      position: { lat: field.lat, lng: field.lng },
      draggable: true,
      zIndex: 10,
      cursor: 'move',
      icon: {
        kind: 'circle',
        radius: 8,
        fill: '#001D3D',
        stroke: '#FFBE00',
        strokeWidth: 2.5,
      },
      onDrag: (pos) => this.handlers.onMove(field.id, pos.lat, pos.lng),
      onClick: () => this.handlers.onSelect(field.id),
    });

    const rotHandle = this.map.addMarker({
      position: rotHandlePos(field, this.spec),
      draggable: true,
      zIndex: 11,
      cursor: 'grab',
      icon: rotIcon(field.rotation),
      onDrag: (pos) => {
        const current = this.fields.get(field.id);
        if (!current) return;
        const rotation = bearingFromCenter(current, pos);
        rotHandle.setIcon(rotIcon(rotation));
        this.handlers.onRotate(field.id, rotation);
      },
      onDragEnd: () => {
        const current = this.fields.get(field.id);
        if (current) rotHandle.setPosition(rotHandlePos(current, this.spec));
      },
      onClick: () => this.handlers.onSelect(field.id),
    });

    const eh = edgeHandlePositions(field, this.spec);
    const makeStepper = (
      position: { lat: number; lng: number },
      sign: 1 | -1,
      key: 'rows' | 'cols',
    ) =>
      this.map.addMarker({
        position,
        zIndex: 11,
        cursor: 'pointer',
        icon: {
          kind: 'circle',
          radius: 9,
          fill: sign > 0 ? '#FFBE00' : '#0b2a4d',
          stroke: '#001D3D',
          strokeWidth: 1.5,
          label: { text: sign > 0 ? '+' : '−', color: sign > 0 ? '#001D3D' : '#FFBE00' },
        },
        onClick: () => {
          this.handlers.onSelect(field.id);
          this.handlers.onBump(field.id, key, sign);
        },
      });

    const layer: Layer = {
      polys,
      center,
      rotHandle,
      steppers: {
        colPlus: makeStepper(eh.colPlus, 1, 'cols'),
        colMinus: makeStepper(eh.colMinus, -1, 'cols'),
        rowPlus: makeStepper(eh.rowPlus, 1, 'rows'),
        rowMinus: makeStepper(eh.rowMinus, -1, 'rows'),
      },
    };
    this.layers.set(field.id, layer);
    if (!this.handlesVisible) this.applyHandleVisibility(layer);
  }

  /**
   * Toggles the on-map rotation arrow and +/- steppers, and swaps the panels
   * to their black presentation look. The centre marker stays so the field can
   * still be dragged, and the sidebar controls are unaffected.
   */
  setHandlesVisible(visible: boolean) {
    if (visible === this.handlesVisible) return;
    this.handlesVisible = visible;
    this.layers.forEach((layer, id) => {
      this.applyHandleVisibility(layer);
      const field = this.fields.get(id);
      if (!field) return;
      layer.polys.forEach((p) => p.remove());
      layer.polys = this.buildPanelPolys(field);
    });
  }

  private applyHandleVisibility(layer: Layer) {
    layer.rotHandle.setVisible(this.handlesVisible);
    Object.values(layer.steppers).forEach((m) => m.setVisible(this.handlesVisible));
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

    layer.polys.forEach((p) => p.remove());
    layer.polys = this.buildPanelPolys(field);

    if (!opts.skipCenter) layer.center.setPosition({ lat: field.lat, lng: field.lng });
    if (!opts.skipRotHandle) {
      layer.rotHandle.setPosition(rotHandlePos(field, this.spec));
      layer.rotHandle.setIcon(rotIcon(field.rotation));
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
      layer.polys.forEach((p) => p.remove());
      layer.center.remove();
      layer.rotHandle.remove();
      Object.values(layer.steppers).forEach((m) => m.remove());
      this.layers.delete(id);
    }
    this.fields.delete(id);
  }

  clearAll() {
    Array.from(this.layers.keys()).forEach((id) => this.remove(id));
  }

  private buildPanelPolys(field: Field) {
    const style = this.handlesVisible ? PANEL_STYLE.editing : PANEL_STYLE.presenting;
    return fieldPanelCorners(field, this.spec).map((corners) =>
      this.map.addPolygon({
        paths: corners,
        strokeColor: style.stroke,
        strokeWeight: 0.8,
        fillColor: style.fill,
        fillOpacity: this.handlesVisible ? 0.85 : 0.95,
        onClick: () => this.handlers.onSelect(field.id),
      }),
    );
  }
}
