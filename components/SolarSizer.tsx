'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AddressSearch from './AddressSearch';
import CompassRose from './CompassRose';
import EditorSidebar from './EditorSidebar';
import Topbar from './Topbar';
import { FieldLayers } from '@/lib/fieldLayers';
import { DEFAULT_PANEL_SPEC, clampGridSide } from '@/lib/geo';
import { loadGoogleMaps } from '@/lib/mapsLoader';
import { FRANCE_CENTER, FRANCE_ZOOM, ROADMAP_STYLE, ROOF_ZOOM } from '@/lib/mapStyle';
import type {
  AddressSuggestion,
  Field,
  PanelSpec,
  RoofSegment,
  SelectedAddress,
  SolarSource,
} from '@/lib/types';

/** Time given to the fly-to animation before the sidebar offset + Solar call. */
const PAN_SETTLE_MS = 900;
/** Half the sidebar width, so the roof isn't hidden behind the panel. */
const SIDEBAR_OFFSET_PX = -170;

export default function SolarSizer() {
  const [view, setView] = useState<'map' | 'editor'>('map');
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [panelSpec, setPanelSpec] = useState<PanelSpec>(DEFAULT_PANEL_SPEC);
  const [solarLoading, setSolarLoading] = useState(false);
  const [solarSource, setSolarSource] = useState<SolarSource>(null);
  const [solarMaxPanels, setSolarMaxPanels] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const layersRef = useRef<FieldLayers | null>(null);
  const panTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mirrors `fields` so map drag handlers never read a stale closure. */
  const fieldsRef = useRef<Field[]>([]);
  const specRef = useRef<PanelSpec>(DEFAULT_PANEL_SPEC);
  const roofAzimuthRef = useRef<number>(180);

  fieldsRef.current = fields;
  specRef.current = panelSpec;

  /** Single write path for field edits: update React state, then the overlays. */
  const patchField = useCallback(
    (
      id: string,
      patch: Partial<Field>,
      opts: { skipCenter?: boolean; skipRotHandle?: boolean } = {},
    ) => {
      const next = fieldsRef.current.map((f) => (f.id === id ? { ...f, ...patch } : f));
      fieldsRef.current = next;
      setFields(next);
      const updated = next.find((f) => f.id === id);
      if (updated) layersRef.current?.update(updated, opts);
    },
    [],
  );

  // Boot the map once. The div lives for the whole session so switching between
  // the search screen and the editor never re-instantiates it.
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;

        const map = new maps.Map(mapDivRef.current, {
          center: FRANCE_CENTER,
          zoom: FRANCE_ZOOM,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: 'greedy',
          styles: ROADMAP_STYLE,
        });
        mapRef.current = map;

        layersRef.current = new FieldLayers(map, specRef.current, {
          onSelect: (id) => setSelectedFieldId(id),
          onMove: (id, lat, lng) => patchField(id, { lat, lng }, { skipCenter: true }),
          onRotate: (id, rotation) => patchField(id, { rotation }, { skipRotHandle: true }),
          onBump: (id, key, delta) => {
            const field = fieldsRef.current.find((f) => f.id === id);
            if (field) patchField(id, { [key]: clampGridSide(field[key] + delta) });
          },
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setMapError(e.message);
      });

    return () => {
      cancelled = true;
      if (panTimer.current) clearTimeout(panTimer.current);
    };
  }, [patchField]);

  // Keep panel geometry in sync when the Solar API reports real panel dimensions.
  useEffect(() => {
    layersRef.current?.setSpec(panelSpec);
  }, [panelSpec]);

  async function fetchSolar(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/solar?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (!data.available) {
        setPanelSpec(DEFAULT_PANEL_SPEC);
        roofAzimuthRef.current = 180;
        setSolarSource('fallback');
        setSolarMaxPanels(0);
        return;
      }

      setPanelSpec({
        heightM: data.panelHeightMeters || DEFAULT_PANEL_SPEC.heightM,
        widthM: data.panelWidthMeters || DEFAULT_PANEL_SPEC.widthM,
        capacityW: data.panelCapacityWatts || DEFAULT_PANEL_SPEC.capacityW,
      });

      const segments: RoofSegment[] = data.roofSegments || [];
      roofAzimuthRef.current = Math.round(segments[0]?.azimuthDegrees ?? 180);
      layersRef.current?.drawRoofOutlines(segments);

      setSolarSource('api');
      setSolarMaxPanels(data.maxArrayPanelsCount || 0);
    } catch {
      setPanelSpec(DEFAULT_PANEL_SPEC);
      roofAzimuthRef.current = 180;
      setSolarSource('fallback');
      setSolarMaxPanels(0);
    } finally {
      setSolarLoading(false);
    }
  }

  async function handleSelectAddress(suggestion: AddressSuggestion) {
    layersRef.current?.clearAll();
    fieldsRef.current = [];
    setFields([]);
    setSelectedFieldId(null);
    setExportError(null);
    setAddress(suggestion);
    setView('editor');
    setSolarLoading(true);
    setSolarSource(null);
    setSolarMaxPanels(0);

    try {
      const res = await fetch(`/api/geocode?placeId=${encodeURIComponent(suggestion.placeId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Géocodage impossible.');

      const { lat, lng } = data;
      setAddress({ ...suggestion, lat, lng });

      const map = mapRef.current;
      if (!map) {
        await fetchSolar(lat, lng);
        return;
      }

      map.setMapTypeId('satellite');
      map.setZoom(ROOF_ZOOM);
      map.panTo({ lat, lng });

      if (panTimer.current) clearTimeout(panTimer.current);
      panTimer.current = setTimeout(() => {
        map.panBy(SIDEBAR_OFFSET_PX, 0);
        void fetchSolar(lat, lng);
      }, PAN_SETTLE_MS);
    } catch {
      setSolarLoading(false);
      setSolarSource('fallback');
    }
  }

  function handleBackToSearch() {
    if (panTimer.current) clearTimeout(panTimer.current);
    layersRef.current?.clearAll();
    const map = mapRef.current;
    if (map) {
      map.setMapTypeId('roadmap');
      map.setZoom(FRANCE_ZOOM);
      map.panTo(FRANCE_CENTER);
    }
    fieldsRef.current = [];
    setFields([]);
    setSelectedFieldId(null);
    setAddress(null);
    setView('map');
    setSolarLoading(false);
    setSolarSource(null);
    setSolarMaxPanels(0);
    setExportError(null);
    setPanelSpec(DEFAULT_PANEL_SPEC);
  }

  function handleAddField() {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    if (!center) return;

    const field: Field = {
      id: `f${Date.now().toString(36)}`,
      lat: center.lat(),
      lng: center.lng(),
      rows: 4,
      cols: 6,
      rotation: roofAzimuthRef.current,
    };

    const next = [...fieldsRef.current, field];
    fieldsRef.current = next;
    setFields(next);
    setSelectedFieldId(field.id);
    layersRef.current?.add(field);
  }

  function handleRemoveField(id: string) {
    layersRef.current?.remove(id);
    const next = fieldsRef.current.filter((f) => f.id !== id);
    fieldsRef.current = next;
    setFields(next);
    setSelectedFieldId((current) => (current === id ? null : current));
  }

  function handleBump(key: 'rows' | 'cols', delta: number) {
    if (!selectedFieldId) return;
    const field = fieldsRef.current.find((f) => f.id === selectedFieldId);
    if (field) patchField(selectedFieldId, { [key]: clampGridSide(field[key] + delta) });
  }

  async function handleExport() {
    const map = mapRef.current;
    const center = map?.getCenter();
    const zoom = map?.getZoom();
    if (!map || !center || zoom === undefined || !fieldsRef.current.length) return;

    setExportBusy(true);
    setExportError(null);

    try {
      const res = await fetch('/api/staticmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center: { lat: center.lat(), lng: center.lng() },
          zoom,
          fields: fieldsRef.current,
          panelSpec: specRef.current,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExportError(data.error || `Export impossible (${res.status}).`);
        return;
      }

      const slug = (address?.label || 'export')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 60);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-toiture-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export impossible.');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#e8f0f8' }} />

      <Topbar showBack={view === 'editor'} onBack={handleBackToSearch} />

      {mapError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 400,
            background: '#fff',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 18px',
            borderRadius: 10,
            fontSize: 13,
            maxWidth: 420,
          }}
        >
          Carte indisponible : {mapError}
        </div>
      )}

      {view === 'map' && <AddressSearch onSelect={handleSelectAddress} />}

      {view === 'editor' && (
        <>
          <EditorSidebar
            addressLabel={address?.label || ''}
            solarLoading={solarLoading}
            solarSource={solarSource}
            solarMaxPanels={solarMaxPanels}
            fields={fields}
            selectedFieldId={selectedFieldId}
            panelSpec={panelSpec}
            exportBusy={exportBusy}
            exportError={exportError}
            onAddField={handleAddField}
            onSelectField={setSelectedFieldId}
            onRemoveField={handleRemoveField}
            onBump={handleBump}
            onRotation={(value) => {
              if (selectedFieldId) patchField(selectedFieldId, { rotation: value });
            }}
            onExport={handleExport}
          />
          <CompassRose />
        </>
      )}
    </main>
  );
}
