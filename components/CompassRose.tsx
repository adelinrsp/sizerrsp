/** The map is locked north-up, so a fixed rose is enough to read panel rotation. */
export default function CompassRose() {
  const cardinal = (style: React.CSSProperties, label: string, gold = false) => (
    <span
      style={{
        position: 'absolute',
        fontSize: gold ? 12 : 11,
        fontWeight: gold ? 700 : 600,
        color: gold ? 'var(--gold)' : 'rgba(255,255,255,0.75)',
        ...style,
      }}
    >
      {label}
    </span>
  );

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 20,
        top: 76,
        width: 76,
        height: 76,
        zIndex: 150,
        background: 'rgba(0,29,61,0.72)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '50%',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}
    >
      {cardinal({ top: 3, left: '50%', transform: 'translateX(-50%)' }, 'N', true)}
      {cardinal({ bottom: 3, left: '50%', transform: 'translateX(-50%)' }, 'S')}
      {cardinal({ right: 4, top: '50%', transform: 'translateY(-50%)' }, 'E')}
      {cardinal({ left: 4, top: '50%', transform: 'translateY(-50%)' }, 'O')}
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ position: 'absolute', inset: 0 }}>
        <line x1="38" y1="14" x2="38" y2="62" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1="14" y1="38" x2="62" y2="38" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <path d="M38 16 L33 30 L38 26 L43 30 Z" fill="#FFBE00" />
      </svg>
    </div>
  );
}
