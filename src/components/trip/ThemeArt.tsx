/**
 * ThemeArt — decorative SVG marks for Ocean theme.
 *
 * Design direction: minimal / clean. Ocean theme uses whitespace, not decorative
 * illustrations, so these components render subtle marks or nothing.
 */

interface ThemeArtProps {
  dark: boolean;
}

/** Day header decoration (used inside DaySection header). */
export function DayHeaderArt(_: ThemeArtProps) {
  return null;
}

/** Divider art — rendered between major sections. */
export function DividerArt(_: ThemeArtProps) {
  return null;
}

/** Footer art — rendered below the timeline list. */
export function FooterArt({ dark }: ThemeArtProps) {
  const waveStroke = dark ? 'rgba(224,244,250,0.25)' : 'rgba(0,119,182,0.20)';
  return (
    <div
      aria-hidden="true"
      className="mt-8 mb-3 flex justify-center"
    >
      <svg
        width="160"
        height="18"
        viewBox="0 0 160 18"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 9 Q 20 2 40 9 T 80 9 T 120 9 T 160 9"
          stroke={waveStroke}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Nav art — right-side ornament in the sticky nav. */
export function NavArt(_: ThemeArtProps) {
  return null;
}
