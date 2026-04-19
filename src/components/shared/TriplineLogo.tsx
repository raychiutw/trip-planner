
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — Ocean brand mark (triple-line "Trip/Line" metaphor).
 *
 * - Mobile: 32x32 Ocean-blue rounded box with three parallel lines
 * - Desktop: same box + "Trip/Line" wordmark inline
 */
export default function TriplineLogo({ isOnline }: TriplineLogoProps) {
  const boxBg = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
      style={{ gap: 10 }}
    >
      {/* 32x32 Ocean mark (always visible) */}
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: boxBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="3" y1="6" x2="19" y2="6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.95" />
          <line x1="3" y1="11" x2="19" y2="11" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
          <line x1="3" y1="16" x2="19" y2="16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          <circle cx="4" cy="6" r="1.25" fill="#ffffff" />
          <circle cx="11" cy="11" r="1.25" fill="#ffffff" opacity="0.8" />
          <circle cx="18" cy="16" r="1.25" fill="#ffffff" opacity="0.65" />
        </svg>
        {!isOnline && (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            style={{ position: 'absolute', top: -4, right: -4 }}
          >
            <circle cx="7" cy="7" r="7" fill="var(--color-destructive)" />
            <line x1="3" y1="11" x2="11" y2="3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </span>

      {/* Desktop wordmark */}
      <span
        className="tripline-logo-desktop"
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--color-foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        Trip<span style={{ opacity: 0.35 }}>/</span>Line
      </span>
    </span>
  );
}
