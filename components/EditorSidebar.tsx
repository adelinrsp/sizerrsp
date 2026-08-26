'use client';

import type { Field, PanelSpec, SolarSource } from '@/lib/types';

type Props = {
  addressLabel: string;
  solarLoading: boolean;
  solarSource: SolarSource;
  solarMaxPanels: number;
  fields: Field[];
  selectedFieldId: string | null;
  panelSpec: PanelSpec;
  exportBusy: boolean;
  exportError: string | null;
  onAddField: () => void;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onBump: (key: 'rows' | 'cols', delta: number) => void;
  onRotation: (value: number) => void;
  onExport: () => void;
};

const SECTION_BORDER = '1px solid rgba(255,255,255,0.09)';
const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--gold)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export default function EditorSidebar({
  addressLabel,
  solarLoading,
  solarSource,
  solarMaxPanels,
  fields,
  selectedFieldId,
  panelSpec,
  exportBusy,
  exportError,
  onAddField,
  onSelectField,
  onRemoveField,
  onBump,
  onRotation,
  onExport,
}: Props) {
  const panelCount = fields.reduce((sum, f) => sum + f.rows * f.cols, 0);
  const power = ((panelCount * panelSpec.capacityW) / 1000).toFixed(1);
  const area = (panelCount * panelSpec.heightM * panelSpec.widthM).toFixed(1);
  const selectedIndex = fields.findIndex((f) => f.id === selectedFieldId);
  const selected = selectedIndex >= 0 ? fields[selectedIndex] : null;

  const stepper = (label: string, value: number, key: 'rows' | 'cols') => (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-label={`${label} moins`}
          onClick={() => onBump(key, -1)}
          style={stepperBtn}
        >
          −
        </button>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label} plus`}
          onClick={() => onBump(key, 1)}
          style={stepperBtn}
        >
          +
        </button>
      </div>
    </div>
  );

  const stat = (label: string, value: string, unit?: string) => (
    <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 8px' }}>
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
            {' '}
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <aside
      style={{
        position: 'absolute',
        left: 0,
        top: 56,
        bottom: 0,
        width: 340,
        maxWidth: '88vw',
        background: 'var(--navy)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInLeft 0.3s ease',
        boxShadow: '4px 0 32px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ padding: '18px 20px 14px', borderBottom: SECTION_BORDER }}>
        <div style={{ ...LABEL, marginBottom: 5 }}>Adresse sélectionnée</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.4 }}>
          {addressLabel}
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: SECTION_BORDER }}>
        <div style={{ ...LABEL, marginBottom: 10 }}>Analyse Google Solar</div>

        {solarLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,190,0,0.08)',
              border: '1px solid rgba(255,190,0,0.2)',
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: 13,
                height: 13,
                border: '2px solid rgba(255,190,0,0.25)',
                borderTopColor: '#FFBE00',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
              Interrogation de l’API Solar…
            </span>
          </div>
        )}

        {!solarLoading && solarSource === 'api' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.28)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                background: '#4ade80',
                borderRadius: '50%',
                flexShrink: 0,
                marginTop: 3,
                boxShadow: '0 0 8px rgba(74,222,128,0.7)',
              }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                Toit analysé — Google Solar API
              </div>
              {solarMaxPanels > 0 && (
                <div style={{ fontSize: 10, color: 'rgba(255,190,0,0.75)', marginTop: 2 }}>
                  {solarMaxPanels} emplacements recommandés par Google Solar
                </div>
              )}
            </div>
          </div>
        )}

        {!solarLoading && solarSource === 'fallback' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.28)',
              borderRadius: 8,
              padding: '9px 12px',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                background: '#fbbf24',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
              Délimitation estimée (hors couverture)
            </span>
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            lineHeight: 1.5,
            margin: '8px 0 0',
          }}
        >
          Ajoutez un champ de panneaux puis faites-le glisser sur le toit. Ajustez lignes, colonnes
          et rotation.
        </p>
      </div>

      <div
        style={{
          padding: '16px 20px',
          borderBottom: SECTION_BORDER,
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={LABEL}>Champs de panneaux</div>
          <button
            type="button"
            onClick={onAddField}
            style={{
              background: 'var(--gold)',
              border: 'none',
              color: 'var(--navy)',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M6 1v10M1 6h10" stroke="#001D3D" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Champ
          </button>
        </div>

        {fields.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '22px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 9,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.4)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Aucun champ. Cliquez sur « + Champ » pour placer une première grille de panneaux sur le
              toit.
            </p>
          </div>
        )}

        {fields.map((f, i) => {
          const active = f.id === selectedFieldId;
          return (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectField(f.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectField(f.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                background: active ? 'rgba(255,190,0,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? 'rgba(255,190,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Champ {i + 1}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {f.rows}×{f.cols} · {f.rows * f.cols} panneaux · {f.rotation}°
                </div>
              </div>
              <button
                type="button"
                aria-label={`Supprimer le champ ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveField(f.id);
                }}
                style={{
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: '#fca5a5',
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}

        {selected && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              style={{
                ...LABEL,
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Réglage — Champ {selectedIndex + 1}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 14,
              }}
            >
              {stepper('Lignes', selected.rows, 'rows')}
              {stepper('Colonnes', selected.cols, 'cols')}
            </div>
            <div>
              <label
                htmlFor="rotation"
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 6,
                }}
              >
                Rotation — {selected.rotation}°
              </label>
              <input
                id="rotation"
                type="range"
                min={0}
                max={359}
                value={selected.rotation}
                onChange={(e) => onRotation(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#FFBE00', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderBottom: SECTION_BORDER }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stat('Panneaux', String(panelCount))}
          {stat('Puissance', power, 'kWc')}
          {stat('Surface', area, 'm²')}
        </div>
      </div>

      <div style={{ padding: '14px 20px 20px' }}>
        <button
          type="button"
          onClick={onExport}
          disabled={panelCount === 0 || exportBusy}
          style={{
            width: '100%',
            height: 46,
            background: panelCount > 0 ? 'var(--gold)' : 'rgba(255,190,0,0.3)',
            border: 'none',
            color: 'var(--navy)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: panelCount > 0 && !exportBusy ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 10V2M8 10l-3-3M8 10l3-3M2.5 12.5h11"
              stroke="#001D3D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {exportBusy ? 'Export en cours…' : 'Exporter le plan de toiture'}
        </button>

        {panelCount === 0 && (
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,190,0,0.55)',
              textAlign: 'center',
              margin: '8px 0 0',
            }}
          >
            Ajoutez au moins un champ de panneaux
          </p>
        )}

        {exportError && (
          <p
            role="alert"
            style={{
              fontSize: 11,
              color: '#fca5a5',
              lineHeight: 1.5,
              margin: '9px 0 0',
              padding: '9px 11px',
              background: 'rgba(220,38,38,0.14)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 7,
            }}
          >
            {exportError}
          </p>
        )}
      </div>
    </aside>
  );
}

const stepperBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 15,
};
