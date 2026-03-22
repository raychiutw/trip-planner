import React from 'react';

interface TpLogoProps {
  isOnline: boolean;
}

/**
 * TP Logo — Handwritten style, T left P right.
 * Online:  accent color (var(--color-accent)), no badge
 * Offline: grey TP strokes + red WiFi-off badge (overflow: visible)
 * Both states share the same SVG viewBox and outer dimensions for layout stability.
 */
export default function TpLogo({ isOnline }: TpLogoProps) {
  const strokeColor = isOnline ? 'var(--color-accent)' : 'var(--color-disabled)';

  return (
    <span
      className={`tp-logo${isOnline ? '' : ' tp-logo--offline'}`}
      aria-label={isOnline ? 'Trip Planner' : 'Trip Planner（離線）'}
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
        {/* T horizontal stroke */}
        <path
          d="M2 3 C4 1.5, 9 1, 16 3"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* T vertical stroke */}
        <path
          d="M9.5 2.5 C9 7, 10 13, 9 22"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* P vertical stroke */}
        <path
          d="M19 8 C18.5 14, 19.5 20, 18.5 28"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* P bump/bowl */}
        <path
          d="M19 8 C21 7, 28 6.5, 32 10 C35 13, 32 17.5, 27 18.5 C23 19, 20 17.5, 19 16.5"
          stroke={strokeColor}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* WiFi-off badge (bottom-right, overflows viewBox via overflow: visible) */}
        {!isOnline && (
          <g transform="translate(25, 16)">
            <circle cx="7" cy="7" r="7.5" fill="var(--color-destructive)" />
            <path
              d="M4 5.5 a5 5 0 0 1 6 0"
              stroke="var(--color-accent-foreground)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M5 7.5 a3 3 0 0 1 4 0"
              stroke="var(--color-accent-foreground)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="7" cy="9.5" r="0.9" fill="var(--color-accent-foreground)" />
            <line
              x1="3"
              y1="11.5"
              x2="11"
              y2="3"
              stroke="var(--color-accent-foreground)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </span>
  );
}
