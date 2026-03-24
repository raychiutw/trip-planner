
interface TriplineLogoProps {
  isOnline: boolean;
}

/**
 * Tripline Logo — V3 style: "Tripline" text with triple wave lines.
 * Two wave lines pass through text body, one main arc below text with endpoint dots.
 * Online:  accent color
 * Offline: grey strokes + red WiFi-off badge
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
        height="26"
        viewBox="0 0 130 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Wave line 1: through text upper body */}
        <path
          d="M4 8 Q20 5.5, 36 8 Q52 10.5, 68 8 Q84 5.5, 95 8"
          stroke={midColor}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Wave line 2: through text lower body */}
        <path
          d="M4 12 Q16 10, 26 12 Q36 14, 46 12 Q56 10, 66 12 Q76 14, 86 12"
          stroke={lightColor}
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Text: Tripline */}
        <text
          x="4"
          y="17"
          fontFamily="Comfortaa, 'Nunito', sans-serif"
          fontWeight="700"
          fontSize="18"
          fill="var(--color-foreground)"
        >
          Tripline
        </text>
        {/* Main arc below text, extends beyond */}
        <path
          d="M4 21 Q35 18, 65 21 Q95 24, 126 20"
          stroke={mainColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Start dot */}
        <circle cx="4" cy="21" r="2" fill={mainColor} />
        {/* End dot */}
        <circle cx="126" cy="20" r="2" fill={mainColor} />
        {/* WiFi-off badge */}
        {!isOnline && (
          <g transform="translate(110, 4)">
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
