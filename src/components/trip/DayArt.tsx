import { memo, useMemo } from 'react';
import { extractArtKeys, type ArtKey } from '../../lib/dayArtMapping';
import type { Entry } from '../../types/trip';

/* ===== DayArt — dynamic Day Header decoration based on timeline content ===== */

interface DayArtProps {
  entries: Entry[];
  dark: boolean;
}

/* ===== SVG Art Elements ===== */
/* Each returns an SVG fragment positioned within viewBox "0 -10 200 100" */
/* Position slots: slot0 ~x:130, slot1 ~x:60, slot2 ~x:20 (right to left) */

const SLOT_X = [130, 55, 10];

function artElement(key: ArtKey, slot: number, dark: boolean): React.ReactNode {
  const x = SLOT_X[slot] ?? 10;
  const lo = dark ? 0.10 : 0.20; // low opacity
  const hi = dark ? 0.15 : 0.30; // high opacity

  switch (key) {
    case 'snorkel':
      return (
        <g key={key} transform={`translate(${x},10)`} opacity={hi}>
          {/* Snorkel mask */}
          <ellipse cx="12" cy="16" rx="14" ry="10" stroke={dark ? '#7EC0E8' : '#2A8EB0'} fill="none" strokeWidth="2.5" />
          <circle cx="6" cy="14" r="4" fill={dark ? '#7EC0E8' : '#2A8EB0'} opacity="0.5" />
          <circle cx="18" cy="14" r="4" fill={dark ? '#7EC0E8' : '#2A8EB0'} opacity="0.5" />
          {/* Snorkel tube */}
          <path d="M26 12 Q30 4 26 -4 Q24 -8 20 -8" stroke={dark ? '#7EC0E8' : '#2A8EB0'} fill="none" strokeWidth="2" strokeLinecap="round" />
          {/* Coral */}
          <g transform="translate(-8,30)">
            <path d="M0 20 Q2 10 0 0 M0 12 Q6 8 8 0 M0 14 Q-4 10 -6 4" stroke={dark ? '#F4A08A' : '#E86A4A'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
      );

    case 'beach':
      return (
        <g key={key} transform={`translate(${x},8)`} opacity={hi}>
          {/* Palm tree */}
          <rect x="8" y="24" width="5" height="40" rx="2.5" fill={dark ? '#B08040' : '#8B6914'} />
          <ellipse cx="10" cy="24" rx="22" ry="8" fill={dark ? '#5A9C6C' : '#2D8A2D'} transform="rotate(-30 10 24)" />
          <ellipse cx="10" cy="24" rx="18" ry="6" fill={dark ? '#7EC89A' : '#3CA03C'} transform="rotate(25 10 24)" />
          <ellipse cx="10" cy="24" rx="16" ry="6" fill={dark ? '#5A9C6C' : '#2D8A2D'} transform="rotate(-55 10 24)" />
          {/* Waves */}
          <path d="M-10 60 Q5 52 20 60 Q35 68 50 60" stroke={dark ? '#5090B0' : '#2A8EB0'} fill="none" strokeWidth="2" opacity="0.6" />
        </g>
      );

    case 'aquarium':
      return (
        <g key={key} transform={`translate(${x},12)`} opacity={hi}>
          {/* Whale shark body */}
          <ellipse cx="20" cy="20" rx="24" ry="14" fill={dark ? '#5090B0' : '#2870A0'} />
          {/* Tail */}
          <path d="M44 20 L56 10 L56 30Z" fill={dark ? '#5090B0' : '#2870A0'} />
          {/* Eye */}
          <circle cx="6" cy="16" r="3" fill={dark ? '#1E1A16' : '#FBF3E8'} />
          {/* Spots */}
          <circle cx="18" cy="12" r="2" fill={dark ? '#7EC0E8' : '#FBF3E8'} opacity="0.5" />
          <circle cx="28" cy="16" r="1.5" fill={dark ? '#7EC0E8' : '#FBF3E8'} opacity="0.5" />
          <circle cx="22" cy="24" r="1.5" fill={dark ? '#7EC0E8' : '#FBF3E8'} opacity="0.5" />
          {/* Small fish */}
          <g transform="translate(-8,40)" opacity="0.7">
            <ellipse cx="0" cy="0" rx="5" ry="3" fill={dark ? '#F4A08A' : '#E86A4A'} />
            <polygon points="5,-3 10,0 5,3" fill={dark ? '#F4A08A' : '#E86A4A'} />
          </g>
        </g>
      );

    case 'sunset':
      return (
        <g key={key} transform={`translate(${x},8)`} opacity={hi}>
          {/* Sun */}
          <circle cx="20" cy="20" r="18" fill={dark ? '#FFD080' : '#F47B5E'} />
          {/* Rays */}
          <g stroke={dark ? '#FFD080' : '#F47B5E'} strokeWidth="2" strokeLinecap="round" opacity="0.5">
            <line x1="20" y1="-4" x2="20" y2="2" />
            <line x1="20" y1="38" x2="20" y2="44" />
            <line x1="-2" y1="20" x2="4" y2="20" />
            <line x1="36" y1="20" x2="42" y2="20" />
          </g>
          {/* Horizon */}
          <line x1="-10" y1="38" x2="50" y2="38" stroke={dark ? '#FFD080' : '#F47B5E'} strokeWidth="1.5" opacity="0.3" />
        </g>
      );

    case 'shrine':
    case 'torii':
      return (
        <g key={key} transform={`translate(${x},5)`} opacity={hi}>
          {/* Torii gate */}
          <rect x="0" y="8" width="5" height="52" fill={dark ? '#D4A88E' : '#B8856C'} />
          <rect x="30" y="8" width="5" height="52" fill={dark ? '#D4A88E' : '#B8856C'} />
          <rect x="-6" y="0" width="48" height="7" rx="2" fill={dark ? '#D4A88E' : '#B8856C'} />
          <rect x="-3" y="11" width="42" height="4" fill={dark ? '#D4A88E' : '#B8856C'} />
        </g>
      );

    case 'castle':
      return (
        <g key={key} transform={`translate(${x},4)`} opacity={hi}>
          {/* Castle silhouette */}
          <rect x="8" y="20" width="30" height="40" fill={dark ? '#D4A88E' : '#9A6B50'} />
          <rect x="4" y="30" width="38" height="30" fill={dark ? '#D4A88E' : '#9A6B50'} />
          {/* Roof tiers */}
          <path d="M6 20 L23 4 L40 20" fill={dark ? '#B08060' : '#7A5A40'} />
          <path d="M12 30 L23 16 L34 30" fill={dark ? '#B08060' : '#7A5A40'} />
        </g>
      );

    case 'temple':
      return (
        <g key={key} transform={`translate(${x},10)`} opacity={hi}>
          {/* Temple roof */}
          <path d="M-5 24 Q20 0 45 24" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2.5" />
          <path d="M0 24 Q20 6 40 24" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          {/* Pillars */}
          <line x1="5" y1="24" x2="5" y2="50" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="3" />
          <line x1="35" y1="24" x2="35" y2="50" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="3" />
        </g>
      );

    case 'garden':
      return (
        <g key={key} transform={`translate(${x},8)`} opacity={hi}>
          {/* Pavilion */}
          <path d="M-5 22 Q15 4 35 22" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          <line x1="3" y1="22" x2="3" y2="44" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="2" />
          <line x1="27" y1="22" x2="27" y2="44" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="2" />
          {/* Pond */}
          <ellipse cx="15" cy="50" rx="20" ry="6" fill={dark ? '#5090B0' : '#2A8EB0'} opacity="0.3" />
        </g>
      );

    case 'market':
      return (
        <g key={key} transform={`translate(${x},10)`} opacity={hi}>
          {/* Market stall roof */}
          <path d="M0 10 Q12 0 24 10 Q36 0 48 10" fill={dark ? '#F4A08A' : '#E86A4A'} opacity="0.6" />
          {/* Stall body */}
          <rect x="2" y="10" width="44" height="30" fill={dark ? '#D4A88E' : '#9A6B50'} opacity="0.4" />
          {/* Items */}
          <circle cx="14" cy="24" r="4" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.5" />
          <circle cx="26" cy="24" r="4" fill={dark ? '#7EC89A' : '#4A8C5C'} opacity="0.5" />
          <circle cx="38" cy="24" r="4" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.5" />
        </g>
      );

    case 'nightmarket':
      return (
        <g key={key} transform={`translate(${x},4)`} opacity={hi}>
          {/* Lanterns */}
          <ellipse cx="10" cy="18" rx="7" ry="10" fill={dark ? '#F4A08A' : '#E86A4A'} />
          {dark && <circle cx="10" cy="18" r="14" fill="#F4A08A" opacity="0.15" />}
          <line x1="10" y1="8" x2="10" y2="2" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1" />
          <ellipse cx="30" cy="14" rx="6" ry="9" fill={dark ? '#FFD080' : '#D4856C'} />
          {dark && <circle cx="30" cy="14" r="12" fill="#FFD080" opacity="0.12" />}
          <line x1="30" y1="5" x2="30" y2="0" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1" />
          <ellipse cx="48" cy="20" rx="7" ry="10" fill={dark ? '#F4A08A' : '#E86A4A'} />
          {dark && <circle cx="48" cy="20" r="14" fill="#F4A08A" opacity="0.15" />}
          <line x1="48" y1="10" x2="48" y2="4" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1" />
        </g>
      );

    case 'shopping':
      return (
        <g key={key} transform={`translate(${x},12)`} opacity={lo}>
          {/* Shopping bag */}
          <rect x="4" y="16" width="28" height="32" rx="4" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          <path d="M12 16 Q12 4 18 4 Q24 4 24 16" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          {/* Star */}
          <circle cx="18" cy="30" r="4" fill={dark ? '#FFD080' : '#E86A4A'} opacity="0.5" />
        </g>
      );

    case 'airport':
      return (
        <g key={key} transform={`translate(${x},20) rotate(-12)`} opacity={hi}>
          {/* Airplane */}
          <path d="M0 0 L-6 3 L-22 3 L-26 7 L-22 3 L-36 4 L-36 1 L-22 1 L-6 -3Z" fill={dark ? '#D4A88E' : '#7A6A56'} transform="scale(1.6)" />
        </g>
      );

    case 'rental':
      return (
        <g key={key} transform={`translate(${x},22)`} opacity={lo}>
          {/* Car */}
          <path d="M8 10 Q12 0 24 0 Q36 0 40 10" fill={dark ? '#5090B0' : '#2870A0'} />
          <rect x="2" y="10" width="44" height="18" rx="4" fill={dark ? '#5090B0' : '#2870A0'} />
          <circle cx="14" cy="28" r="5" fill={dark ? '#D4A88E' : '#7A6A56'} />
          <circle cx="34" cy="28" r="5" fill={dark ? '#D4A88E' : '#7A6A56'} />
          {/* Key */}
          <circle cx="48" cy="4" r="4" stroke={dark ? '#FFD080' : '#E86A4A'} fill="none" strokeWidth="1.5" />
          <line x1="52" y1="4" x2="58" y2="4" stroke={dark ? '#FFD080' : '#E86A4A'} strokeWidth="1.5" />
        </g>
      );

    case 'train':
      return (
        <g key={key} transform={`translate(${x},16)`} opacity={lo}>
          {/* Train body */}
          <rect x="0" y="4" width="40" height="24" rx="6" fill={dark ? '#5090B0' : '#2870A0'} />
          {/* Windows */}
          <rect x="6" y="8" width="10" height="8" rx="2" fill={dark ? '#1E1A16' : '#FBF3E8'} opacity="0.5" />
          <rect x="22" y="8" width="10" height="8" rx="2" fill={dark ? '#1E1A16' : '#FBF3E8'} opacity="0.5" />
          {/* Track */}
          <line x1="-8" y1="32" x2="50" y2="32" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="2" />
        </g>
      );

    case 'park':
      return (
        <g key={key} transform={`translate(${x},6)`} opacity={hi}>
          {/* Tree */}
          <circle cx="18" cy="18" r="16" fill={dark ? '#5A9C6C' : '#4A8C5C'} />
          <circle cx="10" cy="22" r="12" fill={dark ? '#7EC89A' : '#5A9C6C'} />
          <rect x="14" y="32" width="6" height="20" fill={dark ? '#B08040' : '#8B6914'} />
          {/* Bird */}
          <path d="M38 12 Q42 6 46 12" stroke={dark ? '#7EC89A' : '#4A8C5C'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );

    case 'mountain':
      return (
        <g key={key} transform={`translate(${x},8)`} opacity={lo}>
          {/* Mountains */}
          <path d="M0 56 L22 8 L44 56" fill={dark ? '#5A9C6C' : '#4A8C5C'} />
          <path d="M20 56 L38 16 L56 56" fill={dark ? '#5090B0' : '#2870A0'} opacity="0.6" />
          {/* Snow cap */}
          <path d="M22 8 L16 20 L28 20Z" fill={dark ? '#FBF3E8' : '#FFFFFF'} opacity="0.4" />
        </g>
      );

    case 'bridge':
      return (
        <g key={key} transform={`translate(${x},18)`} opacity={lo}>
          {/* Bridge arch */}
          <path d="M0 24 Q25 0 50 24" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2.5" />
          {/* Pillars */}
          <line x1="12" y1="14" x2="12" y2="24" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1.5" />
          <line x1="25" y1="6" x2="25" y2="24" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1.5" />
          <line x1="38" y1="14" x2="38" y2="24" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1.5" />
          {/* Water */}
          <path d="M-5 28 Q10 24 25 28 Q40 32 55 28" stroke={dark ? '#5090B0' : '#2A8EB0'} fill="none" strokeWidth="1.5" opacity="0.5" />
        </g>
      );

    case 'island':
      return (
        <g key={key} transform={`translate(${x},16)`} opacity={hi}>
          {/* Island */}
          <ellipse cx="22" cy="32" rx="28" ry="8" fill={dark ? '#5A9C6C' : '#4A8C5C'} opacity="0.5" />
          {/* Palm */}
          <rect x="18" y="8" width="4" height="24" rx="2" fill={dark ? '#B08040' : '#8B6914'} />
          <ellipse cx="20" cy="8" rx="16" ry="6" fill={dark ? '#5A9C6C' : '#2D8A2D'} transform="rotate(-20 20 8)" />
          <ellipse cx="20" cy="8" rx="14" ry="5" fill={dark ? '#7EC89A' : '#3CA03C'} transform="rotate(30 20 8)" />
          {/* Water */}
          <path d="M-8 38 Q8 34 22 38 Q36 42 52 38" stroke={dark ? '#5090B0' : '#2A8EB0'} fill="none" strokeWidth="1.5" opacity="0.4" />
        </g>
      );

    case 'hotel':
      return (
        <g key={key} transform={`translate(${x},8)`} opacity={lo}>
          {/* Building */}
          <rect x="4" y="8" width="36" height="48" rx="2" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          {/* Windows */}
          <rect x="10" y="14" width="8" height="8" rx="1" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.4" />
          <rect x="24" y="14" width="8" height="8" rx="1" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.4" />
          <rect x="10" y="28" width="8" height="8" rx="1" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.4" />
          <rect x="24" y="28" width="8" height="8" rx="1" fill={dark ? '#FFD080' : '#F47B5E'} opacity="0.4" />
          {/* Door */}
          <rect x="16" y="44" width="12" height="12" rx="1" fill={dark ? '#D4A88E' : '#9A6B50'} opacity="0.5" />
        </g>
      );

    case 'onsen':
      return (
        <g key={key} transform={`translate(${x},16)`} opacity={hi}>
          {/* Pool */}
          <ellipse cx="20" cy="32" rx="24" ry="10" fill={dark ? '#5090B0' : '#2A8EB0'} opacity="0.3" />
          {/* Steam */}
          <path d="M10 20 Q12 12 10 4" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 18 Q22 10 20 2" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 20 Q32 12 30 4" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'cafe':
      return (
        <g key={key} transform={`translate(${x},18)`} opacity={lo}>
          {/* Cup */}
          <rect x="4" y="4" width="24" height="20" rx="4" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          {/* Handle */}
          <path d="M28 8 Q36 8 36 16 Q36 24 28 24" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          {/* Steam */}
          <path d="M12 0 Q14 -6 12 -10" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M20 -2 Q22 -8 20 -12" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );

    case 'ramen':
      return (
        <g key={key} transform={`translate(${x},16)`} opacity={lo}>
          {/* Bowl */}
          <ellipse cx="20" cy="20" rx="22" ry="8" fill={dark ? '#D4A88E' : '#9A6B50'} opacity="0.4" />
          <path d="M0 20 Q0 36 20 36 Q40 36 40 20" fill={dark ? '#D4A88E' : '#9A6B50'} opacity="0.3" />
          {/* Steam */}
          <path d="M12 12 Q14 4 12 -2" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M22 10 Q24 2 22 -4" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="1.5" strokeLinecap="round" />
          {/* Chopsticks */}
          <line x1="28" y1="16" x2="40" y2="2" stroke={dark ? '#FFD080' : '#8B6914'} strokeWidth="1.5" />
          <line x1="30" y1="16" x2="44" y2="4" stroke={dark ? '#FFD080' : '#8B6914'} strokeWidth="1.5" />
        </g>
      );

    case 'museum':
      return (
        <g key={key} transform={`translate(${x},6)`} opacity={lo}>
          {/* Roof */}
          <path d="M0 20 L24 0 L48 20" fill={dark ? '#D4A88E' : '#7A6A56'} opacity="0.5" />
          {/* Pillars */}
          <rect x="6" y="20" width="4" height="36" fill={dark ? '#D4A88E' : '#7A6A56'} />
          <rect x="18" y="20" width="4" height="36" fill={dark ? '#D4A88E' : '#7A6A56'} />
          <rect x="30" y="20" width="4" height="36" fill={dark ? '#D4A88E' : '#7A6A56'} />
          <rect x="42" y="20" width="4" height="36" fill={dark ? '#D4A88E' : '#7A6A56'} />
        </g>
      );

    case 'tower':
      return (
        <g key={key} transform={`translate(${x + 10},0)`} opacity={lo}>
          {/* Tower */}
          <rect x="0" y="4" width="8" height="56" rx="2" fill={dark ? '#D4A88E' : '#7A6A56'} />
          {/* Observation deck */}
          <rect x="-4" y="8" width="16" height="6" rx="2" fill={dark ? '#D4A88E' : '#7A6A56'} />
          {/* Antenna */}
          <line x1="4" y1="4" x2="4" y2="-6" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1.5" />
          <circle cx="4" cy="-6" r="2" fill={dark ? '#F4A08A' : '#E86A4A'} opacity="0.6" />
        </g>
      );

    case 'lighthouse':
      return (
        <g key={key} transform={`translate(${x},4)`} opacity={hi}>
          {/* Body */}
          <rect x="8" y="16" width="14" height="40" rx="2" fill={dark ? '#D4A88E' : '#C0C8D0'} />
          {/* Top */}
          <rect x="6" y="10" width="18" height="8" rx="2" fill={dark ? '#5090B0' : '#1A6B8A'} />
          <polygon points="15,0 4,10 26,10" fill={dark ? '#F4A08A' : '#C04030'} />
          {/* Light beam */}
          <line x1="15" y1="10" x2="0" y2="4" stroke="#FFD080" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
          <line x1="15" y1="10" x2="30" y2="4" stroke="#FFD080" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
        </g>
      );

    case 'default':
    default:
      return (
        <g key="default" transform={`translate(${x},12)`} opacity={lo}>
          {/* Compass */}
          <circle cx="18" cy="18" r="14" stroke={dark ? '#D4A88E' : '#7A6A56'} fill="none" strokeWidth="2" />
          <line x1="18" y1="6" x2="18" y2="30" stroke={dark ? '#F4A08A' : '#E86A4A'} strokeWidth="1.5" />
          <line x1="6" y1="18" x2="30" y2="18" stroke={dark ? '#D4A88E' : '#7A6A56'} strokeWidth="1.5" />
          <circle cx="18" cy="18" r="2" fill={dark ? '#FFD080' : '#E86A4A'} />
        </g>
      );
  }
}

/* ===== Component ===== */

export const DayArt = memo(function DayArt({ entries, dark }: DayArtProps) {
  const artKeys = useMemo(() => {
    const titles = entries.map((e) => e.title || '');
    return extractArtKeys(titles, 3);
  }, [entries]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '80%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 -10 200 100"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        {artKeys.map((key, i) => artElement(key, i, dark))}
      </svg>
    </div>
  );
});

export default DayArt;
