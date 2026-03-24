
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — V3 style: handwritten "Tripline" text with triple wave lines.
 * Two wave lines pass through text body, one main arc below text with endpoint dots.
 * Font: Caveat (Google Fonts handwriting), 43px
 */
export default function TriplineLogo({ isOnline }: TriplineLogoProps) {
  const lineColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
    >
      <svg
        width="180"
        height="48"
        viewBox="0 0 180 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Wave line 1: through text upper body */}
        <path
          d="M4 16 Q28 11, 54 16 Q80 21, 106 16 Q132 11, 150 16"
          stroke={lineColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Wave line 2: through text lower body */}
        <path
          d="M4 23 Q20 19, 38 23 Q56 27, 74 23 Q92 19, 110 23 Q124 27, 135 23"
          stroke={lineColor}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Text: Tripline — Caveat handwriting font, 43px */}
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
        {/* Main arc below text, extends beyond */}
        <path
          d="M4 40 Q48 35, 90 40 Q135 45, 175 38"
          stroke={lineColor}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Start dot */}
        <circle cx="4" cy="40" r="2.5" fill={lineColor} />
        {/* End dot */}
        <circle cx="175" cy="38" r="2.5" fill={lineColor} />
        {/* WiFi-off badge */}
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
