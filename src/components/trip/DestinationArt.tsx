import React, { memo } from 'react';

/* ===== Destination Art SVG backgrounds for sticky-nav ===== */

type Destination = 'okinawa' | 'busan' | 'kyoto' | 'banqiao' | 'generic';

/** Resolve tripId prefix to destination key */
export function resolveDestination(tripId: string): Destination {
  if (tripId.startsWith('okinawa')) return 'okinawa';
  if (tripId.startsWith('busan')) return 'busan';
  if (tripId.startsWith('kyoto')) return 'kyoto';
  if (tripId.startsWith('banqiao')) return 'banqiao';
  return 'generic';
}

/* ===== Okinawa: beach + shisa + coral + tropical fish ===== */

function OkinawaLight() {
  return (
    <>
      {/* Waves */}
      <path d="M0 38 Q60 28 120 38 Q180 48 240 38 Q300 28 360 38 Q420 48 480 38" stroke="#2A8EB0" fill="none" strokeWidth="1.5" opacity="0.35" />
      <path d="M0 42 Q60 34 120 42 Q180 50 240 42 Q300 34 360 42 Q420 50 480 42" stroke="#40C0D8" fill="none" strokeWidth="1" opacity="0.20" />
      {/* Coral */}
      <g transform="translate(200,28)" opacity="0.15">
        <path d="M0 16 Q2 8 0 0 M0 10 Q6 6 10 0 M0 12 Q-5 8 -8 2" stroke="#E86A4A" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* Tropical fish */}
      <g transform="translate(340,20)" opacity="0.18">
        <ellipse cx="0" cy="0" rx="10" ry="6" fill="#2A8EB0" />
        <polygon points="10,-5 18,0 10,5" fill="#2A8EB0" />
        <circle cx="-4" cy="-1" r="1.5" fill="#FBF3E8" />
      </g>
      {/* Hibiscus */}
      <g transform="translate(440,6)" opacity="0.15">
        <circle cx="0" cy="0" r="3" fill="#E86A4A" />
        <circle cx="5" cy="-3" r="3" fill="#E86A4A" />
        <circle cx="5" cy="3" r="3" fill="#E86A4A" />
        <circle cx="-5" cy="-3" r="3" fill="#E86A4A" />
        <circle cx="-5" cy="3" r="3" fill="#E86A4A" />
        <circle cx="0" cy="0" r="2" fill="#FFD080" />
      </g>
    </>
  );
}

function OkinawaDark() {
  return (
    <>
      {/* Waves */}
      <path d="M0 38 Q60 28 120 38 Q180 48 240 38 Q300 28 360 38 Q420 48 480 38" stroke="#5090B0" fill="none" strokeWidth="1.5" opacity="0.20" />
      {/* Coral */}
      <g transform="translate(200,28)" opacity="0.08">
        <path d="M0 16 Q2 8 0 0 M0 10 Q6 6 10 0 M0 12 Q-5 8 -8 2" stroke="#F4A08A" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* Fish */}
      <g transform="translate(340,20)" opacity="0.10">
        <ellipse cx="0" cy="0" rx="10" ry="6" fill="#5090B0" />
        <polygon points="10,-5 18,0 10,5" fill="#5090B0" />
        <circle cx="-4" cy="-1" r="1.5" fill="#FFD080" />
      </g>
      {/* Stars */}
      <circle cx="440" cy="10" r="1.5" fill="#FFD080" opacity="0.15" />
      <circle cx="460" cy="20" r="1" fill="#FFF4C0" opacity="0.12" />
    </>
  );
}

/* ===== Busan: Haeundae beach + Gwangan Bridge + seagulls ===== */

function BusanLight() {
  return (
    <>
      {/* Gwangan Bridge */}
      <g transform="translate(40,12)" opacity="0.15">
        <path d="M0 28 Q40 8 80 28 Q120 8 160 28" stroke="#2870A0" fill="none" strokeWidth="2" />
        <line x1="20" y1="18" x2="20" y2="28" stroke="#2870A0" strokeWidth="1.5" />
        <line x1="60" y1="10" x2="60" y2="28" stroke="#2870A0" strokeWidth="1.5" />
        <line x1="100" y1="10" x2="100" y2="28" stroke="#2870A0" strokeWidth="1.5" />
        <line x1="140" y1="18" x2="140" y2="28" stroke="#2870A0" strokeWidth="1.5" />
      </g>
      {/* Seagulls */}
      <g stroke="#2870A0" fill="none" strokeWidth="1.5" strokeLinecap="round" opacity="0.20">
        <path d="M280 12 Q286 5 292 12 Q298 5 304 12" />
        <path d="M320 8 Q325 2 330 8 Q335 2 340 8" />
        <path d="M360 16 Q364 10 368 16" />
      </g>
      {/* Waves */}
      <path d="M0 40 Q80 30 160 40 Q240 50 320 40 Q400 30 480 40" stroke="#2A8EB0" fill="none" strokeWidth="1" opacity="0.20" />
      {/* Busan Tower hint */}
      <g transform="translate(430,4)" opacity="0.12">
        <rect x="-2" y="0" width="4" height="32" rx="1" fill="#2870A0" />
        <circle cx="0" cy="0" r="5" fill="none" stroke="#2870A0" strokeWidth="1.5" />
      </g>
    </>
  );
}

function BusanDark() {
  return (
    <>
      {/* Bridge silhouette */}
      <g transform="translate(40,12)" opacity="0.08">
        <path d="M0 28 Q40 8 80 28 Q120 8 160 28" stroke="#7EC0E8" fill="none" strokeWidth="2" />
        <line x1="20" y1="18" x2="20" y2="28" stroke="#7EC0E8" strokeWidth="1.5" />
        <line x1="60" y1="10" x2="60" y2="28" stroke="#7EC0E8" strokeWidth="1.5" />
        <line x1="100" y1="10" x2="100" y2="28" stroke="#7EC0E8" strokeWidth="1.5" />
        <line x1="140" y1="18" x2="140" y2="28" stroke="#7EC0E8" strokeWidth="1.5" />
      </g>
      {/* Seagulls */}
      <g stroke="#7EC0E8" fill="none" strokeWidth="1.5" strokeLinecap="round" opacity="0.10">
        <path d="M280 12 Q286 5 292 12 Q298 5 304 12" />
        <path d="M330 8 Q335 2 340 8" />
      </g>
      {/* Stars */}
      <circle cx="360" cy="10" r="1.5" fill="#FFD080" opacity="0.12" />
      <circle cx="420" cy="6" r="1" fill="#FFF4C0" opacity="0.10" />
      <circle cx="450" cy="18" r="1.2" fill="#FFD080" opacity="0.10" />
    </>
  );
}

/* ===== Kyoto: torii + maple leaves + bamboo + temple ===== */

function KyotoLight() {
  return (
    <>
      {/* Torii gate */}
      <g transform="translate(50,6)" opacity="0.15">
        <rect x="-10" y="6" width="4" height="30" fill="#B8856C" />
        <rect x="6" y="6" width="4" height="30" fill="#B8856C" />
        <rect x="-14" y="0" width="28" height="5" rx="1.5" fill="#B8856C" />
        <rect x="-12" y="8" width="24" height="3" fill="#B8856C" />
      </g>
      {/* Maple leaves */}
      <g opacity="0.18">
        <path d="M180 10 L183 4 L186 10 L182 8 L184 8Z" fill="#D4856C" />
        <path d="M200 18 L203 12 L206 18 L202 16 L204 16Z" fill="#E86A4A" />
        <path d="M220 8 L223 2 L226 8 L222 6 L224 6Z" fill="#D4856C" />
      </g>
      {/* Bamboo stalks */}
      <g transform="translate(320,0)" opacity="0.12">
        <line x1="0" y1="0" x2="0" y2="48" stroke="#4A8C5C" strokeWidth="3" />
        <line x1="12" y1="0" x2="12" y2="48" stroke="#5A9C6C" strokeWidth="2.5" />
        <path d="M0 12 Q-8 8 -12 4" stroke="#4A8C5C" strokeWidth="1" fill="none" />
        <path d="M12 20 Q20 16 24 12" stroke="#5A9C6C" strokeWidth="1" fill="none" />
      </g>
      {/* Temple roof */}
      <g transform="translate(420,10)" opacity="0.12">
        <path d="M-20 20 L0 4 L20 20" stroke="#7A6A56" fill="none" strokeWidth="2" />
        <path d="M-16 20 L0 8 L16 20" stroke="#7A6A56" fill="none" strokeWidth="1.5" />
      </g>
    </>
  );
}

function KyotoDark() {
  return (
    <>
      {/* Torii gate */}
      <g transform="translate(50,6)" opacity="0.08">
        <rect x="-10" y="6" width="4" height="30" fill="#D4A88E" />
        <rect x="6" y="6" width="4" height="30" fill="#D4A88E" />
        <rect x="-14" y="0" width="28" height="5" rx="1.5" fill="#D4A88E" />
        <rect x="-12" y="8" width="24" height="3" fill="#D4A88E" />
      </g>
      {/* Maple leaves */}
      <g opacity="0.10">
        <path d="M180 10 L183 4 L186 10 L182 8 L184 8Z" fill="#F4A08A" />
        <path d="M200 18 L203 12 L206 18 L202 16 L204 16Z" fill="#F4A08A" />
        <path d="M220 8 L223 2 L226 8 L222 6 L224 6Z" fill="#D4A88E" />
      </g>
      {/* Bamboo */}
      <g transform="translate(320,0)" opacity="0.06">
        <line x1="0" y1="0" x2="0" y2="48" stroke="#7EC89A" strokeWidth="3" />
        <line x1="12" y1="0" x2="12" y2="48" stroke="#7EC89A" strokeWidth="2.5" />
      </g>
      {/* Stars */}
      <circle cx="420" cy="8" r="1.5" fill="#FFD080" opacity="0.10" />
      <circle cx="440" cy="20" r="1" fill="#FFF4C0" opacity="0.08" />
      <circle cx="280" cy="6" r="1.2" fill="#FFD080" opacity="0.08" />
    </>
  );
}

/* ===== Banqiao: Lin Family Garden + night market lanterns + old street eaves ===== */

function BanqiaoLight() {
  return (
    <>
      {/* Garden pavilion roof */}
      <g transform="translate(50,8)" opacity="0.15">
        <path d="M-20 20 Q0 0 20 20" stroke="#7A6A56" fill="none" strokeWidth="2" />
        <line x1="-12" y1="20" x2="-12" y2="36" stroke="#7A6A56" strokeWidth="2" />
        <line x1="12" y1="20" x2="12" y2="36" stroke="#7A6A56" strokeWidth="2" />
      </g>
      {/* Lanterns */}
      <g opacity="0.20">
        <ellipse cx="180" cy="14" rx="6" ry="8" fill="#E86A4A" />
        <line x1="180" y1="6" x2="180" y2="2" stroke="#7A6A56" strokeWidth="1" />
        <ellipse cx="220" cy="12" rx="5" ry="7" fill="#D4856C" />
        <line x1="220" y1="5" x2="220" y2="2" stroke="#7A6A56" strokeWidth="1" />
        <ellipse cx="260" cy="16" rx="6" ry="8" fill="#E86A4A" />
        <line x1="260" y1="8" x2="260" y2="4" stroke="#7A6A56" strokeWidth="1" />
      </g>
      {/* Old street eaves */}
      <g transform="translate(340,4)" opacity="0.12">
        <path d="M0 12 Q15 4 30 12 Q45 4 60 12 Q75 4 90 12" stroke="#7A6A56" fill="none" strokeWidth="1.5" />
        <line x1="0" y1="12" x2="0" y2="28" stroke="#7A6A56" strokeWidth="1" />
        <line x1="30" y1="8" x2="30" y2="28" stroke="#7A6A56" strokeWidth="1" />
        <line x1="60" y1="8" x2="60" y2="28" stroke="#7A6A56" strokeWidth="1" />
        <line x1="90" y1="12" x2="90" y2="28" stroke="#7A6A56" strokeWidth="1" />
      </g>
    </>
  );
}

function BanqiaoDark() {
  return (
    <>
      {/* Garden pavilion */}
      <g transform="translate(50,8)" opacity="0.08">
        <path d="M-20 20 Q0 0 20 20" stroke="#D4A88E" fill="none" strokeWidth="2" />
        <line x1="-12" y1="20" x2="-12" y2="36" stroke="#D4A88E" strokeWidth="2" />
        <line x1="12" y1="20" x2="12" y2="36" stroke="#D4A88E" strokeWidth="2" />
      </g>
      {/* Glowing lanterns */}
      <g opacity="0.12">
        <ellipse cx="180" cy="14" rx="6" ry="8" fill="#F4A08A" />
        <circle cx="180" cy="14" r="12" fill="#F4A08A" opacity="0.15" />
        <ellipse cx="220" cy="12" rx="5" ry="7" fill="#FFD080" />
        <circle cx="220" cy="12" r="10" fill="#FFD080" opacity="0.12" />
        <ellipse cx="260" cy="16" rx="6" ry="8" fill="#F4A08A" />
        <circle cx="260" cy="16" r="12" fill="#F4A08A" opacity="0.15" />
      </g>
      {/* Eaves */}
      <g transform="translate(340,4)" opacity="0.06">
        <path d="M0 12 Q15 4 30 12 Q45 4 60 12 Q75 4 90 12" stroke="#D4A88E" fill="none" strokeWidth="1.5" />
      </g>
    </>
  );
}

/* ===== Generic: travel icons ===== */

function GenericLight() {
  return (
    <>
      {/* Airplane */}
      <g transform="translate(80,16) rotate(-8) scale(1.2)" opacity="0.12">
        <path d="M0 0 L-5 2.5 L-18 2.5 L-22 6 L-18 2.5 L-30 3.5 L-30 1 L-18 1 L-5 -2.5Z" fill="#7A6A56" />
      </g>
      {/* Compass */}
      <g transform="translate(300,22)" opacity="0.12">
        <circle cx="0" cy="0" r="12" stroke="#7A6A56" fill="none" strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="0" y2="8" stroke="#E86A4A" strokeWidth="1" />
        <line x1="-8" y1="0" x2="8" y2="0" stroke="#7A6A56" strokeWidth="1" />
      </g>
      {/* Suitcase */}
      <g transform="translate(420,14)" opacity="0.12">
        <rect x="-10" y="0" width="20" height="16" rx="3" stroke="#7A6A56" fill="none" strokeWidth="1.5" />
        <rect x="-5" y="-4" width="10" height="4" rx="2" stroke="#7A6A56" fill="none" strokeWidth="1" />
      </g>
    </>
  );
}

function GenericDark() {
  return (
    <>
      {/* Airplane */}
      <g transform="translate(80,16) rotate(-8) scale(1.2)" opacity="0.08">
        <path d="M0 0 L-5 2.5 L-18 2.5 L-22 6 L-18 2.5 L-30 3.5 L-30 1 L-18 1 L-5 -2.5Z" fill="#D4A88E" />
      </g>
      {/* Compass */}
      <g transform="translate(300,22)" opacity="0.08">
        <circle cx="0" cy="0" r="12" stroke="#D4A88E" fill="none" strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="0" y2="8" stroke="#F4A08A" strokeWidth="1" />
        <line x1="-8" y1="0" x2="8" y2="0" stroke="#D4A88E" strokeWidth="1" />
      </g>
      {/* Stars */}
      <circle cx="420" cy="10" r="1.5" fill="#FFD080" opacity="0.10" />
      <circle cx="440" cy="24" r="1" fill="#FFF4C0" opacity="0.08" />
    </>
  );
}

/* ===== Destination content map (hoisted to module level to avoid recreation on every render) ===== */

const DESTINATION_CONTENT: Record<string, Record<string, React.ReactNode>> = {
  okinawa: { light: <OkinawaLight />, dark: <OkinawaDark /> },
  busan: { light: <BusanLight />, dark: <BusanDark /> },
  kyoto: { light: <KyotoLight />, dark: <KyotoDark /> },
  banqiao: { light: <BanqiaoLight />, dark: <BanqiaoDark /> },
  generic: { light: <GenericLight />, dark: <GenericDark /> },
};

/* ===== Main Component ===== */

interface DestinationArtProps {
  tripId: string;
  dark: boolean;
}

export const DestinationArt = memo(function DestinationArt({ tripId, dark }: DestinationArtProps) {
  const dest = resolveDestination(tripId);
  const mode = dark ? 'dark' : 'light';

  return (
    <div className="destination-art" aria-hidden="true">
      <svg
        viewBox="0 0 480 48"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%' }}
      >
        {DESTINATION_CONTENT[dest][mode]}
      </svg>
    </div>
  );
});

export default DestinationArt;
