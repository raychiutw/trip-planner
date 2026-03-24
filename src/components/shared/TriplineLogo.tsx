
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — V3 style: handwritten "Tripline" text with triple wave lines.
 * Two wave lines pass through text body, one main arc below text with endpoint dots.
 * Font: Caveat (Google Fonts handwriting)
 */
export default function TriplineLogo({ isOnline }: TriplineLogoProps) {
  const mainColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';
  const midColor = isOnline ? '#C4704F' : 'var(--color-disabled)';
  const lightColor = isOnline ? '#D4815A' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
    >
      <svg
        width="130"
        height="36"
        viewBox="0 0 130 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Wave line 1: through text upper body */}
        <path
          d="M3 12 Q22 8, 42 12 Q62 16, 82 12 Q102 8, 115 12"
          stroke={midColor}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Wave line 2: through text lower body */}
        <path
          d="M3 17 Q16 14, 30 17 Q44 20, 58 17 Q72 14, 86 17 Q96 20, 105 17"
          stroke={lightColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Text: Tripline — Caveat handwriting font */}
        <text
          x="3"
          y="24"
          fontFamily="Caveat, 'Patrick Hand', cursive"
          fontWeight="600"
          fontSize="29"
          fill="var(--color-foreground)"
        >
          Tripline
        </text>
        {/* Main arc below text, extends beyond */}
        <path
          d="M3 29 Q35 25, 65 29 Q100 33, 128 27"
          stroke={mainColor}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Start dot */}
        <circle cx="3" cy="29" r="2.2" fill={mainColor} />
        {/* End dot */}
        <circle cx="128" cy="27" r="2.2" fill={mainColor} />
        {/* WiFi-off badge */}
        {!isOnline && (
          <g transform="translate(112, 8)">
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
