
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
        width="160"
        height="32"
        viewBox="0 0 160 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Wave line 1: through text upper body */}
        <path
          d="M4 10 Q24 7, 44 10 Q64 13, 84 10 Q104 7, 118 10"
          stroke={midColor}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Wave line 2: through text lower body */}
        <path
          d="M4 15 Q18 12.5, 32 15 Q46 17.5, 60 15 Q74 12.5, 88 15 Q98 17.5, 108 15"
          stroke={lightColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Text: Tripline */}
        <text
          x="4"
          y="21"
          fontFamily="Comfortaa, 'Nunito', sans-serif"
          fontWeight="700"
          fontSize="22"
          fill="var(--color-foreground)"
        >
          Tripline
        </text>
        {/* Main arc below text, extends beyond */}
        <path
          d="M4 26 Q42 22, 80 26 Q118 30, 155 25"
          stroke={mainColor}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Start dot */}
        <circle cx="4" cy="26" r="2.2" fill={mainColor} />
        {/* End dot */}
        <circle cx="155" cy="25" r="2.2" fill={mainColor} />
        {/* WiFi-off badge */}
        {!isOnline && (
          <g transform="translate(138, 6)">
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
