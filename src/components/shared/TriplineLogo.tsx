
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
  const midColor = isOnline ? '#D4815A' : 'var(--color-disabled)';
  const lightColor = isOnline ? '#E8956F' : 'var(--color-disabled)';

  return (
    <span
      className={`tripline-logo${isOnline ? '' : ' tripline-logo--offline'}`}
      aria-label={isOnline ? 'Tripline' : 'Tripline（離線）'}
    >
      <svg
        width="100"
        height="20"
        viewBox="0 0 100 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Wave line 1: through text upper body */}
        <path
          d="M4 7 Q16 5, 28 7 Q40 9, 52 7 Q64 5, 73 7"
          stroke={midColor}
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Wave line 2: through text lower body */}
        <path
          d="M4 9.5 Q14 8.2, 22 9.5 Q30 10.8, 38 9.5 Q46 8.2, 54 9.5 Q62 10.8, 66 9.5"
          stroke={lightColor}
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
          opacity="0.35"
        />
        {/* Text: Tripline */}
        <text
          x="4"
          y="13"
          fontFamily="Comfortaa, 'Nunito', sans-serif"
          fontWeight="700"
          fontSize="14"
          fill="var(--color-primary)"
        >
          Tripline
        </text>
        {/* Main arc below text, extends beyond */}
        <path
          d="M4 16 Q28 14, 48 16 Q72 18, 97 15"
          stroke={mainColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Start dot */}
        <circle cx="4" cy="16" r="1.5" fill={mainColor} />
        {/* End dot */}
        <circle cx="97" cy="15" r="1.5" fill={mainColor} />
        {/* WiFi-off badge */}
        {!isOnline && (
          <g transform="translate(82, 4)">
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
