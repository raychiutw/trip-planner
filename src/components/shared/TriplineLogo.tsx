
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — L13 style: "T" as timeline.
 * The T's vertical stroke is the timeline, horizontal bar has two node dots.
 * Online:  accent color
 * Offline: grey strokes + red WiFi-off badge
 */
export default function TriplineLogo({ isOnline }: TriplineLogoProps) {
  const strokeColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';
  const dotColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
    >
      <svg
        width="36"
        height="28"
        viewBox="0 0 36 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* T horizontal stroke (timeline bar) */}
        <line x1="2" y1="4" x2="22" y2="4" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
        {/* T vertical stroke (timeline trunk) */}
        <line x1="12" y1="4" x2="12" y2="26" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
        {/* Timeline node dots on horizontal bar */}
        <circle cx="5" cy="4" r="3.2" fill={dotColor} />
        <circle cx="19" cy="4" r="3.2" fill={dotColor} />
        {/* Timeline node dot at bottom */}
        <circle cx="12" cy="26" r="3.2" fill={dotColor} />
        {/* WiFi-off badge */}
        {!isOnline && (
          <g transform="translate(22, 16)">
            <circle cx="7" cy="7" r="7.5" fill="var(--color-destructive)" />
            <path d="M4 5.5 a5 5 0 0 1 6 0" stroke="var(--color-accent-foreground)" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 7.5 a3 3 0 0 1 4 0" stroke="var(--color-accent-foreground)" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7" cy="9.5" r="0.9" fill="var(--color-accent-foreground)" />
            <line x1="3" y1="11.5" x2="11" y2="3" stroke="var(--color-accent-foreground)" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </span>
  );
}
