
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — dual mode:
 * - Mobile (<768px): 32x32 triple-wave mark (favicon style)
 * - Desktop (≥768px): full handwritten "Tripline" text with wave lines
 */
export default function TriplineLogo({ isOnline }: TriplineLogoProps) {
  const lineColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
    >
      {/* Mobile: 32px triple-wave mark */}
      <svg
        className="tripline-logo-mobile"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M4 10 Q10 5, 16 10 Q22 15, 28 10" stroke={lineColor} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M4 16.5 Q10 11.5, 16 16.5 Q22 21.5, 28 16.5" stroke={lineColor} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />
        <path d="M4 23 Q10 18, 16 23 Q22 28, 28 23" stroke={lineColor} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.35" />
      </svg>
      {/* Desktop: full logo with text */}
      <svg
        className="tripline-logo-desktop"
        width="180"
        height="48"
        viewBox="0 0 180 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <path
          d="M4 16 Q28 11, 54 16 Q80 21, 106 16 Q132 11, 150 16"
          stroke={lineColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M4 23 Q20 19, 38 23 Q56 27, 74 23 Q92 19, 110 23 Q124 27, 135 23"
          stroke={lineColor}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.45"
        />
        <text
          x="4"
          y="34"
          fontFamily="Caveat, 'Patrick Hand', cursive"
          fontWeight="600"
          fontSize="43"
          fill="var(--color-foreground)"
        >
          Tripline
        </text>
        <path
          d="M4 40 Q48 35, 90 40 Q135 45, 175 38"
          stroke={lineColor}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="4" cy="40" r="2.5" fill={lineColor} />
        <circle cx="175" cy="38" r="2.5" fill={lineColor} />
        {!isOnline && (
          <g transform="translate(158, 10)">
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
