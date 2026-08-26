'use client';

type Props = {
  showBack: boolean;
  onBack: () => void;
};

export default function Topbar({ showBack, onBack }: Props) {
  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--navy)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
        borderBottom: '2px solid rgba(255,190,0,0.25)',
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        Rhône Solaire
      </span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>
        SolarSizerPro
      </span>
      <div style={{ flex: 1 }} />
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.22)',
            color: 'rgba(255,255,255,0.82)',
            padding: '6px 14px',
            borderRadius: 7,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ← Nouvelle adresse
        </button>
      )}
    </header>
  );
}
