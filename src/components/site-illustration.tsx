// A small illustrated building site for empty states and photo-less project covers.
// Colours come from the theme tokens, so it works in light and dark.
export function SiteIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Illustration of a building site">
      <circle cx="262" cy="46" r="26" fill="var(--primary)" opacity="0.35" />
      <ellipse cx="86" cy="52" rx="40" ry="11" fill="var(--surface)" opacity="0.85" />
      <ellipse cx="116" cy="44" rx="26" ry="9" fill="var(--surface)" opacity="0.85" />

      {/* ground */}
      <rect x="0" y="160" width="320" height="40" fill="var(--surface-2)" />
      <rect x="0" y="158" width="320" height="4" fill="var(--line)" />

      {/* crane */}
      <g className="animate-float" style={{ transformOrigin: "232px 40px" }}>
        <rect x="226" y="36" width="8" height="124" fill="var(--data-accent)" />
        <rect x="150" y="30" width="150" height="8" fill="var(--data-accent)" />
        <line x1="236" y1="36" x2="150" y2="30" stroke="var(--data-accent)" strokeWidth="2" />
        <line x1="176" y1="38" x2="176" y2="86" stroke="var(--data-neutral)" strokeWidth="2" />
        <rect x="164" y="86" width="24" height="14" rx="2" fill="var(--data-neutral)" />
        <rect x="222" y="22" width="16" height="14" fill="var(--data-accent)" />
      </g>

      {/* building going up */}
      <rect x="52" y="104" width="104" height="56" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      <rect x="52" y="76" width="64" height="28" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      {[64, 90, 116, 142].map((x) => (
        <rect key={x} x={x} y="116" width="10" height="14" fill="var(--primary-soft)" />
      ))}
      {[66, 92].map((x) => (
        <rect key={x} x={x} y="86" width="10" height="12" fill="var(--primary-soft)" />
      ))}
      <rect x="40" y="70" width="88" height="6" fill="var(--data-neutral)" opacity="0.5" />

      {/* materials */}
      <rect x="176" y="146" width="40" height="14" rx="2" fill="var(--data-accent)" opacity="0.7" />
      <rect x="182" y="132" width="40" height="14" rx="2" fill="var(--data-accent)" opacity="0.5" />
    </svg>
  );
}
