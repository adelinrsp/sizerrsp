'use client';

type Props = {
  visible: boolean;
  onToggle: () => void;
};

/**
 * Hides the on-map rotation arrow and +/- steppers for a clean view — useful
 * when showing the roof to a client. Sits to the left of the Maps zoom
 * controls, which occupy the bottom-right corner.
 */
export default function HandlesToggle({ visible, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!visible}
      title={
        visible
          ? 'Masquer les poignées de rotation et les boutons + / −'
          : 'Afficher les poignées de rotation et les boutons + / −'
      }
      style={{
        position: 'absolute',
        right: 68,
        bottom: 24,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        height: 34,
        padding: '0 13px',
        background: 'rgba(0,29,61,0.78)',
        border: `1px solid ${visible ? 'rgba(255,255,255,0.25)' : 'rgba(255,190,0,0.55)'}`,
        borderRadius: 9,
        backdropFilter: 'blur(4px)',
        color: visible ? 'rgba(255,255,255,0.85)' : 'var(--gold)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      {visible ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.3 3.7A7.4 7.4 0 018 3.5c4.5 0 7 4.5 7 4.5a12 12 0 01-2.4 2.9M4 4.9A12 12 0 001 8s2.5 4.5 7 4.5c1 0 1.9-.2 2.7-.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      Poignées
    </button>
  );
}
