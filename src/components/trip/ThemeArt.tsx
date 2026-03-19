import { type ColorTheme } from '../../hooks/useDarkMode';

interface ThemeArtProps {
  theme: ColorTheme;
  dark: boolean;
}

// ─────────────────────────────────────────────
// DayHeaderArt
// ─────────────────────────────────────────────

function SunLightHeader() {
  return (
    <>
      {/* Sun */}
      <circle cx="170" cy="20" r="20" fill="#F47B5E" opacity="0.55" />
      <g stroke="#F47B5E" strokeWidth="3" strokeLinecap="round" opacity="0.50">
        <line x1="170" y1="-5" x2="170" y2="3" />
        <line x1="170" y1="37" x2="170" y2="45" />
        <line x1="145" y1="20" x2="152" y2="20" />
        <line x1="188" y1="20" x2="195" y2="20" />
        <line x1="152" y1="2" x2="157" y2="7" />
        <line x1="183" y1="33" x2="188" y2="38" />
        <line x1="152" y1="38" x2="157" y2="33" />
        <line x1="183" y1="7" x2="188" y2="2" />
      </g>
      {/* Coconut tree */}
      <g transform="translate(65,12)" opacity="0.50">
        <rect x="6" y="22" width="5" height="48" rx="2.5" fill="#8B6914" />
        <ellipse cx="8" cy="22" rx="25" ry="8" fill="#2D8A2D" transform="rotate(-30 8 22)" />
        <ellipse cx="8" cy="22" rx="22" ry="7" fill="#3CA03C" transform="rotate(25 8 22)" />
        <ellipse cx="8" cy="22" rx="20" ry="7" fill="#2D8A2D" transform="rotate(-60 8 22)" />
        <ellipse cx="8" cy="22" rx="18" ry="6" fill="#3CA03C" transform="rotate(50 8 22)" />
      </g>
      {/* Airplane */}
      <g transform="translate(15,40) rotate(-8) scale(1.4)" opacity="0.40">
        <path d="M0 0 L-5 2.5 L-18 2.5 L-22 6 L-18 2.5 L-30 3.5 L-30 1 L-18 1 L-5 -2.5Z" fill="#F47B5E" />
      </g>
    </>
  );
}

function SunDarkHeader() {
  return (
    <>
      {/* Crescent moon */}
      <circle cx="168" cy="18" r="16" fill="#FFD080" opacity="0.45" />
      <circle cx="160" cy="15" r="14" fill="#1E1A16" />
      {/* Stars */}
      <circle cx="30" cy="12" r="2" fill="#FFD080" opacity="0.50" />
      <circle cx="55" cy="8" r="1.5" fill="#FFF4C0" opacity="0.45" />
      <circle cx="85" cy="22" r="2.5" fill="#FFD080" opacity="0.40" />
      <circle cx="115" cy="10" r="1.8" fill="#FFF4C0" opacity="0.50" />
      <circle cx="140" cy="30" r="1.5" fill="#FFD080" opacity="0.35" />
      <circle cx="45" cy="40" r="2" fill="#FFF4C0" opacity="0.30" />
      {/* Coconut tree */}
      <g transform="translate(65,15)" opacity="0.40">
        <rect x="6" y="20" width="4" height="45" rx="2" fill="#8B6914" />
        <ellipse cx="8" cy="20" rx="20" ry="7" fill="#2D8A2D" transform="rotate(-30 8 20)" />
        <ellipse cx="8" cy="20" rx="18" ry="6" fill="#3CA03C" transform="rotate(25 8 20)" />
        <ellipse cx="8" cy="20" rx="16" ry="6" fill="#2D8A2D" transform="rotate(-60 8 20)" />
      </g>
      {/* Fireflies */}
      <circle cx="100" cy="55" r="3" fill="#F4A08A" opacity="0.35" />
      <circle cx="100" cy="55" r="6" fill="#F4A08A" opacity="0.10" />
      <circle cx="150" cy="60" r="2.5" fill="#FFD080" opacity="0.30" />
      <circle cx="150" cy="60" r="5" fill="#FFD080" opacity="0.08" />
    </>
  );
}

function SkyLightHeader() {
  return (
    <>
      {/* Hot air balloon */}
      <g transform="translate(140,8)" opacity="0.60">
        <ellipse cx="0" cy="0" rx="22" ry="28" fill="#2E7BAF" />
        <ellipse cx="0" cy="0" rx="22" ry="28" fill="#4EA890" clipPath="inset(0 50% 0 0)" />
        <rect x="-8" y="28" width="16" height="9" rx="3" fill="#C08030" />
        <line x1="-9" y1="28" x2="-8" y2="37" stroke="#A06820" strokeWidth="1.5" />
        <line x1="9" y1="28" x2="8" y2="37" stroke="#A06820" strokeWidth="1.5" />
      </g>
      {/* Seagulls */}
      <g stroke="#2E7BAF" fill="none" strokeWidth="2.5" strokeLinecap="round" opacity="0.55">
        <path d="M25 22 Q31 14 37 22 Q43 14 49 22" />
        <path d="M58 32 Q63 25 68 32 Q73 25 78 32" />
        <path d="M10 42 Q15 36 20 42 Q25 36 30 42" />
      </g>
      {/* Cloud */}
      <g opacity="0.30">
        <ellipse cx="90" cy="15" rx="28" ry="11" fill="#2E7BAF" />
        <ellipse cx="108" cy="9" rx="18" ry="9" fill="#5090C0" />
      </g>
    </>
  );
}

function SkyDarkHeader() {
  return (
    <>
      {/* Crescent moon */}
      <circle cx="165" cy="16" r="14" fill="#E0E8FF" opacity="0.40" />
      <circle cx="158" cy="14" r="12" fill="#161C20" />
      {/* Stars */}
      <circle cx="25" cy="15" r="2.5" fill="#E0E8FF" opacity="0.50" />
      <circle cx="50" cy="8" r="1.8" fill="#B0D0FF" opacity="0.45" />
      <circle cx="80" cy="20" r="2" fill="#E0E8FF" opacity="0.40" />
      <circle cx="110" cy="10" r="2.5" fill="#B0D0FF" opacity="0.50" />
      <circle cx="135" cy="28" r="1.5" fill="#E0E8FF" opacity="0.35" />
      <circle cx="40" cy="35" r="2" fill="#B0D0FF" opacity="0.30" />
      <circle cx="95" cy="45" r="1.8" fill="#E0E8FF" opacity="0.35" />
      {/* Sailboat silhouette */}
      <g transform="translate(60,40)" opacity="0.35">
        <path d="M0 0 L3 -22 L6 0Z" fill="#5BA4CF" />
        <path d="M3 -18 L-8 0 L3 0Z" fill="#7ECBB0" />
        <ellipse cx="0" cy="2" rx="10" ry="2.5" fill="#B08040" />
      </g>
    </>
  );
}

function ZenLightHeader() {
  return (
    <>
      {/* Torii gate */}
      <g transform="translate(140,5)" opacity="0.50">
        <rect x="-16" y="8" width="6" height="42" fill="#B8856C" />
        <rect x="10" y="8" width="6" height="42" fill="#B8856C" />
        <rect x="-22" y="0" width="44" height="7" rx="2" fill="#B8856C" />
        <rect x="-19" y="11" width="38" height="4" fill="#B8856C" />
      </g>
      {/* Cherry blossom branch */}
      <g transform="translate(8,12)" opacity="0.55">
        <path d="M0 38 Q18 20 35 28 Q50 33 62 16 Q70 8 80 11" stroke="#705020" fill="none" strokeWidth="3" strokeLinecap="round" />
        <circle cx="35" cy="25" r="5.5" fill="#E8A0A0" opacity="0.80" />
        <circle cx="50" cy="20" r="5" fill="#F0B0B0" opacity="0.70" />
        <circle cx="65" cy="13" r="6" fill="#E8A0A0" opacity="0.80" />
        <circle cx="80" cy="10" r="4.5" fill="#F0B0B0" opacity="0.65" />
        <circle cx="22" cy="32" r="4" fill="#E8A0A0" opacity="0.60" />
      </g>
      {/* Falling petals */}
      <g opacity="0.40">
        <ellipse cx="110" cy="55" rx="2.5" ry="3.5" fill="#E8A0A0" transform="rotate(25 110 55)" />
        <ellipse cx="135" cy="65" rx="2" ry="3" fill="#F0B0B0" transform="rotate(-20 135 65)" />
      </g>
    </>
  );
}

function ZenDarkHeader() {
  return (
    <>
      {/* Torii gate */}
      <g transform="translate(140,5)" opacity="0.38">
        <rect x="-16" y="8" width="6" height="42" fill="#D4A88E" />
        <rect x="10" y="8" width="6" height="42" fill="#D4A88E" />
        <rect x="-22" y="0" width="44" height="7" rx="2" fill="#D4A88E" />
        <rect x="-19" y="11" width="38" height="4" fill="#D4A88E" />
      </g>
      {/* Gold crescent moon */}
      <circle cx="40" cy="15" r="12" fill="#FFD080" opacity="0.38" />
      <circle cx="35" cy="13" r="10" fill="#1A1816" />
      {/* Night cherry blossoms */}
      <g transform="translate(60,30)" opacity="0.35">
        <path d="M0 22 Q12 12 24 16 Q34 18 40 8" stroke="#A08060" fill="none" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="14" r="4.5" fill="#F0A0A0" opacity="0.70" />
        <circle cx="35" cy="10" r="4" fill="#FFB0B0" opacity="0.60" />
        <circle cx="12" cy="18" r="3.5" fill="#F0A0A0" opacity="0.55" />
      </g>
      {/* Firefly */}
      <circle cx="100" cy="55" r="3" fill="#FFD080" opacity="0.35" />
      <circle cx="100" cy="55" r="6" fill="#FFD080" opacity="0.10" />
      {/* Stars */}
      <circle cx="80" cy="10" r="2" fill="#FFD080" opacity="0.45" />
      <circle cx="115" cy="8" r="1.5" fill="#FFF4C0" opacity="0.40" />
      <circle cx="20" cy="45" r="1.8" fill="#FFD080" opacity="0.35" />
    </>
  );
}

export function DayHeaderArt({ theme, dark }: ThemeArtProps) {
  const key = `${theme}-${dark ? 'dark' : 'light'}` as const;

  const content: Record<string, React.ReactNode> = {
    'sun-light': <SunLightHeader />,
    'sun-dark': <SunDarkHeader />,
    'sky-light': <SkyLightHeader />,
    'sky-dark': <SkyDarkHeader />,
    'zen-light': <ZenLightHeader />,
    'zen-dark': <ZenDarkHeader />,
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '60%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 80"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        {content[key]}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// DividerArt
// ─────────────────────────────────────────────

function SunLightDivider() {
  return (
    <>
      <path
        d="M0 18 Q15 8 30 18 Q45 28 60 18 Q75 8 90 18 Q105 28 120 18"
        stroke="#2A8EB0"
        fill="none"
        strokeWidth="2.5"
        opacity="0.40"
      />
      <path
        d="M10 20 Q25 12 40 20 Q55 28 70 20 Q85 12 100 20"
        stroke="#40B8D0"
        fill="none"
        strokeWidth="1.8"
        opacity="0.25"
      />
    </>
  );
}

function SunDarkDivider() {
  return (
    <>
      <circle cx="15" cy="12" r="2" fill="#FFD080" opacity="0.40" />
      <circle cx="15" cy="12" r="4.5" fill="#FFD080" opacity="0.10" />
      <circle cx="42" cy="8" r="1.5" fill="#FFF4C0" opacity="0.35" />
      <circle cx="65" cy="15" r="2" fill="#F4A08A" opacity="0.35" />
      <circle cx="65" cy="15" r="4.5" fill="#F4A08A" opacity="0.10" />
      <circle cx="90" cy="10" r="1.8" fill="#FFD080" opacity="0.40" />
      <circle cx="110" cy="14" r="1.5" fill="#FFF4C0" opacity="0.30" />
    </>
  );
}

function SkyLightDivider() {
  return (
    <g stroke="#2E7BAF" fill="none" strokeWidth="2" strokeLinecap="round" opacity="0.50">
      <path d="M22 12 Q28 5 34 12 Q40 5 46 12" />
      <path d="M68 10 Q73 4 78 10 Q83 4 88 10" />
    </g>
  );
}

function SkyDarkDivider() {
  return (
    <>
      <circle cx="12" cy="12" r="2" fill="#B0D0FF" opacity="0.45" />
      <circle cx="12" cy="12" r="4.5" fill="#B0D0FF" opacity="0.10" />
      <circle cx="38" cy="8" r="1.5" fill="#E0E8FF" opacity="0.40" />
      <circle cx="60" cy="14" r="2.5" fill="#7EC0E8" opacity="0.40" />
      <circle cx="60" cy="14" r="5" fill="#7EC0E8" opacity="0.08" />
      <circle cx="85" cy="10" r="1.8" fill="#E0E8FF" opacity="0.45" />
      <circle cx="108" cy="15" r="2" fill="#B0D0FF" opacity="0.35" />
    </>
  );
}

function ZenLightDivider() {
  return (
    <g opacity="0.40">
      <ellipse cx="22" cy="10" rx="2.5" ry="3.5" fill="#E8A0A0" transform="rotate(35 22 10)" />
      <ellipse cx="50" cy="14" rx="2" ry="3" fill="#F0B0B0" transform="rotate(-15 50 14)" />
      <ellipse cx="78" cy="8" rx="2.5" ry="3.5" fill="#E8A0A0" transform="rotate(45 78 8)" />
      <ellipse cx="105" cy="13" rx="2" ry="3" fill="#F0B0B0" transform="rotate(-25 105 13)" />
    </g>
  );
}

function ZenDarkDivider() {
  return (
    <>
      <circle cx="18" cy="12" r="2.5" fill="#FFD080" opacity="0.40" />
      <circle cx="18" cy="12" r="5" fill="#FFD080" opacity="0.08" />
      <circle cx="45" cy="8" r="1.5" fill="#FFF4C0" opacity="0.38" />
      <circle cx="70" cy="14" r="2" fill="#F0A0A0" opacity="0.35" />
      <circle cx="70" cy="14" r="4.5" fill="#F0A0A0" opacity="0.08" />
      <circle cx="95" cy="10" r="2" fill="#FFD080" opacity="0.42" />
      <circle cx="115" cy="15" r="1.5" fill="#FFF4C0" opacity="0.32" />
    </>
  );
}

export function DividerArt({ theme, dark }: ThemeArtProps) {
  const key = `${theme}-${dark ? 'dark' : 'light'}` as const;

  const content: Record<string, React.ReactNode> = {
    'sun-light': <SunLightDivider />,
    'sun-dark': <SunDarkDivider />,
    'sky-light': <SkyLightDivider />,
    'sky-dark': <SkyDarkDivider />,
    'zen-light': <ZenLightDivider />,
    'zen-dark': <ZenDarkDivider />,
  };

  return (
    <div style={{ textAlign: 'center', padding: '6px 0' }} aria-hidden="true">
      <svg
        viewBox="0 0 120 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: '24px' }}
      >
        {content[key]}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// FooterArt
// ─────────────────────────────────────────────

function SunLightFooter() {
  return (
    <>
      <path
        d="M0 28 Q40 12 80 28 Q120 44 160 28 Q200 12 240 28 Q280 44 320 28 Q360 12 400 28 L400 60 L0 60Z"
        fill="#2A8EB0"
        opacity="0.45"
      />
      <path
        d="M0 38 Q40 25 80 38 Q120 51 160 38 Q200 25 240 38 Q280 51 320 38 Q360 25 400 38 L400 60 L0 60Z"
        fill="#40C0D8"
        opacity="0.25"
      />
    </>
  );
}

function SunDarkFooter() {
  return (
    <>
      <path
        d="M0 32 Q40 18 80 32 Q120 46 160 32 Q200 18 240 32 Q280 46 320 32 Q360 18 400 32 L400 60 L0 60Z"
        fill="#2A8EB0"
        opacity="0.35"
      />
      <path
        d="M0 42 Q40 30 80 42 Q120 54 160 42 Q200 30 240 42 Q280 54 320 42 Q360 30 400 42 L400 60 L0 60Z"
        fill="#40A8C8"
        opacity="0.20"
      />
      <circle cx="80" cy="12" r="2" fill="#FFD080" opacity="0.40" />
      <circle cx="200" cy="8" r="1.5" fill="#FFF4C0" opacity="0.35" />
      <circle cx="320" cy="15" r="2.5" fill="#FFD080" opacity="0.40" />
    </>
  );
}

function SkyLightFooter() {
  return (
    <>
      <path
        d="M0 28 Q40 12 80 28 Q120 44 160 28 Q200 12 240 28 Q280 44 320 28 Q360 12 400 28 L400 60 L0 60Z"
        fill="#2E7BAF"
        opacity="0.50"
      />
      <path
        d="M0 40 Q40 28 80 40 Q120 52 160 40 Q200 28 240 40 Q280 52 320 40 Q360 28 400 40 L400 60 L0 60Z"
        fill="#4EA890"
        opacity="0.28"
      />
      {/* Sailboat */}
      <g transform="translate(340,8)" opacity="0.50">
        <path d="M0 0 L4 -30 L8 0Z" fill="#2E7BAF" />
        <path d="M4 -26 L-10 0 L4 0Z" fill="#4EA890" />
        <ellipse cx="0" cy="2" rx="14" ry="3.5" fill="#B08040" />
      </g>
    </>
  );
}

function SkyDarkFooter() {
  return (
    <>
      <path
        d="M0 32 Q40 18 80 32 Q120 46 160 32 Q200 18 240 32 Q280 46 320 32 Q360 18 400 32 L400 60 L0 60Z"
        fill="#5BA4CF"
        opacity="0.30"
      />
      <path
        d="M0 42 Q40 30 80 42 Q120 54 160 42 Q200 30 240 42 Q280 54 320 42 Q360 30 400 42 L400 60 L0 60Z"
        fill="#7ECBB0"
        opacity="0.18"
      />
      <circle cx="60" cy="10" r="2" fill="#E0E8FF" opacity="0.45" />
      <circle cx="180" cy="6" r="2.5" fill="#B0D0FF" opacity="0.40" />
      <circle cx="300" cy="12" r="1.8" fill="#E0E8FF" opacity="0.38" />
    </>
  );
}

function ZenLightFooter() {
  return (
    <>
      {/* Mountains */}
      <path d="M0 60 L90 22 L180 60Z" fill="#9EB8A8" opacity="0.28" />
      <path d="M70 60 L180 12 L290 60Z" fill="#7A8B9A" opacity="0.22" />
      {/* Snow cap */}
      <path d="M180 12 L168 26 L192 26Z" fill="#E8E2D8" opacity="0.30" />
      {/* Zen circle */}
      <circle cx="340" cy="32" r="24" stroke="#B8856C" fill="none" strokeWidth="3" opacity="0.28" />
    </>
  );
}

function ZenDarkFooter() {
  return (
    <>
      {/* Mountains */}
      <path d="M0 60 L90 25 L180 60Z" fill="#9EB8A8" opacity="0.20" />
      <path d="M70 60 L180 15 L290 60Z" fill="#7A8B9A" opacity="0.16" />
      {/* Zen circle */}
      <circle cx="340" cy="32" r="22" stroke="#D4A88E" fill="none" strokeWidth="2.5" opacity="0.22" />
      {/* Stars */}
      <circle cx="60" cy="12" r="2" fill="#FFD080" opacity="0.42" />
      <circle cx="200" cy="8" r="2.5" fill="#FFF4C0" opacity="0.38" />
      <circle cx="300" cy="15" r="1.8" fill="#FFD080" opacity="0.35" />
    </>
  );
}

export function FooterArt({ theme, dark }: ThemeArtProps) {
  const key = `${theme}-${dark ? 'dark' : 'light'}` as const;

  const content: Record<string, React.ReactNode> = {
    'sun-light': <SunLightFooter />,
    'sun-dark': <SunDarkFooter />,
    'sky-light': <SkyLightFooter />,
    'sky-dark': <SkyDarkFooter />,
    'zen-light': <ZenLightFooter />,
    'zen-dark': <ZenDarkFooter />,
  };

  return (
    <div style={{ margin: '0 -16px', overflow: 'hidden' }} aria-hidden="true">
      <svg
        viewBox="0 0 400 60"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', display: 'block' }}
      >
        {content[key]}
      </svg>
    </div>
  );
}
