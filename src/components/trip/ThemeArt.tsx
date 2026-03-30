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
      <g transform="translate(140,28)" opacity="0.60">
        <ellipse cx="0" cy="0" rx="20" ry="24" fill="#2E7BAF" />
        <ellipse cx="0" cy="0" rx="20" ry="24" fill="#4EA890" clipPath="inset(0 50% 0 0)" />
        <rect x="-7" y="24" width="14" height="8" rx="3" fill="#C08030" />
        <line x1="-8" y1="24" x2="-7" y2="32" stroke="#A06820" strokeWidth="1.5" />
        <line x1="8" y1="24" x2="7" y2="32" stroke="#A06820" strokeWidth="1.5" />
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

function ForestLightHeader() {
  return (
    <>
      {/* Pine trees */}
      <g transform="translate(135,8)" opacity="0.50">
        <polygon points="0,48 12,0 24,48" fill="#4A8C5C" />
        <polygon points="4,48 12,12 20,48" fill="#3D7A4E" />
        <rect x="9" y="48" width="6" height="12" fill="#8B6914" />
      </g>
      <g transform="translate(165,18)" opacity="0.45">
        <polygon points="0,38 10,0 20,38" fill="#5A9C6C" />
        <polygon points="3,38 10,10 17,38" fill="#4A8C5C" />
        <rect x="7" y="38" width="5" height="10" fill="#8B6914" />
      </g>
      {/* Rolling hills */}
      <path d="M0 70 Q30 45 70 60 Q110 75 150 55 Q180 42 200 50" fill="#4A8C5C" opacity="0.20" />
      {/* Fern */}
      <g transform="translate(30,35)" opacity="0.40">
        <path d="M0 30 Q8 15 5 0" stroke="#5A9C6C" fill="none" strokeWidth="2" strokeLinecap="round" />
        <path d="M3 20 Q-6 14 -4 8" stroke="#4A8C5C" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 15 Q12 10 10 4" stroke="#4A8C5C" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* Birds */}
      <g stroke="#4A8C5C" fill="none" strokeWidth="1.8" strokeLinecap="round" opacity="0.35">
        <path d="M80 20 Q84 14 88 20" />
        <path d="M95 15 Q99 9 103 15" />
      </g>
    </>
  );
}

function ForestDarkHeader() {
  return (
    <>
      {/* Gold crescent moon */}
      <circle cx="168" cy="18" r="14" fill="#FFD080" opacity="0.42" />
      <circle cx="161" cy="15" r="12" fill="#1A2018" />
      {/* Pine tree silhouettes */}
      <g transform="translate(130,12)" opacity="0.35">
        <polygon points="0,48 12,0 24,48" fill="#5A9C6C" />
        <rect x="9" y="48" width="6" height="10" fill="#8B6914" />
      </g>
      <g transform="translate(155,22)" opacity="0.30">
        <polygon points="0,36 9,0 18,36" fill="#4A8C5C" />
        <rect x="6" y="36" width="5" height="8" fill="#8B6914" />
      </g>
      {/* Stars */}
      <circle cx="30" cy="12" r="2" fill="#FFD080" opacity="0.48" />
      <circle cx="60" cy="8" r="1.5" fill="#FFF4C0" opacity="0.42" />
      <circle cx="90" cy="22" r="2.5" fill="#FFD080" opacity="0.38" />
      <circle cx="115" cy="10" r="1.8" fill="#FFF4C0" opacity="0.44" />
      {/* Fireflies */}
      <circle cx="50" cy="50" r="3" fill="#B0E890" opacity="0.35" />
      <circle cx="50" cy="50" r="6" fill="#B0E890" opacity="0.10" />
      <circle cx="105" cy="55" r="2.5" fill="#FFD080" opacity="0.30" />
      <circle cx="105" cy="55" r="5" fill="#FFD080" opacity="0.08" />
    </>
  );
}

function SakuraLightHeader() {
  return (
    <>
      {/* Cherry blossom branch */}
      <g transform="translate(100,8)" opacity="0.52">
        <path d="M0 50 Q20 30 40 35 Q60 38 75 20 Q85 10 95 14" stroke="#8B6040" fill="none" strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="32" r="6" fill="#D4708A" opacity="0.80" />
        <circle cx="58" cy="24" r="5.5" fill="#E888A0" opacity="0.70" />
        <circle cx="75" cy="17" r="6.5" fill="#D4708A" opacity="0.80" />
        <circle cx="92" cy="12" r="5" fill="#E888A0" opacity="0.65" />
        <circle cx="25" cy="40" r="4.5" fill="#D4708A" opacity="0.60" />
      </g>
      {/* Falling petals */}
      <g opacity="0.42">
        <ellipse cx="30" cy="30" rx="2.5" ry="3.5" fill="#D4708A" transform="rotate(30 30 30)" />
        <ellipse cx="55" cy="55" rx="2" ry="3" fill="#E888A0" transform="rotate(-25 55 55)" />
        <ellipse cx="80" cy="45" rx="2.5" ry="3.5" fill="#D4708A" transform="rotate(45 80 45)" />
        <ellipse cx="15" cy="60" rx="2" ry="3" fill="#E888A0" transform="rotate(-15 15 60)" />
      </g>
    </>
  );
}

function SakuraDarkHeader() {
  return (
    <>
      {/* Gold crescent moon */}
      <circle cx="165" cy="16" r="14" fill="#FFD080" opacity="0.40" />
      <circle cx="158" cy="14" r="12" fill="#1E1618" />
      {/* Night cherry branch */}
      <g transform="translate(60,25)" opacity="0.38">
        <path d="M0 28 Q15 15 30 20 Q42 22 52 10" stroke="#A08060" fill="none" strokeWidth="2" strokeLinecap="round" />
        <circle cx="30" cy="18" r="5" fill="#E888A0" opacity="0.65" />
        <circle cx="45" cy="12" r="4.5" fill="#D4708A" opacity="0.55" />
        <circle cx="16" cy="22" r="4" fill="#E888A0" opacity="0.50" />
      </g>
      {/* Stars */}
      <circle cx="30" cy="10" r="2" fill="#FFD080" opacity="0.48" />
      <circle cx="55" cy="6" r="1.5" fill="#FFF4C0" opacity="0.42" />
      <circle cx="100" cy="14" r="2.5" fill="#FFD080" opacity="0.40" />
      <circle cx="130" cy="8" r="1.8" fill="#FFF4C0" opacity="0.45" />
      {/* Glowing petal */}
      <ellipse cx="110" cy="55" rx="3" ry="4" fill="#E888A0" opacity="0.30" transform="rotate(20 110 55)" />
    </>
  );
}

function NightLightHeader() {
  return (
    <>
      {/* Crescent moon */}
      <circle cx="168" cy="18" r="16" fill="#6B6B6B" opacity="0.45" />
      <circle cx="160" cy="15" r="14" fill="#F5F5F5" />
      {/* Stars */}
      <circle cx="30" cy="12" r="2" fill="#6B6B6B" opacity="0.50" />
      <circle cx="55" cy="8" r="1.5" fill="#8C8C8C" opacity="0.45" />
      <circle cx="85" cy="22" r="2.5" fill="#6B6B6B" opacity="0.40" />
      <circle cx="115" cy="10" r="1.8" fill="#8C8C8C" opacity="0.50" />
      <circle cx="140" cy="30" r="1.5" fill="#6B6B6B" opacity="0.35" />
      {/* City skyline silhouette */}
      <g transform="translate(8,20)" opacity="0.35">
        <rect x="0" y="20" width="8" height="30" fill="#6B6B6B" />
        <rect x="10" y="10" width="10" height="40" fill="#8C8C8C" />
        <rect x="22" y="16" width="7" height="34" fill="#6B6B6B" />
        <rect x="31" y="5" width="6" height="45" fill="#8C8C8C" />
        <rect x="39" y="18" width="9" height="32" fill="#6B6B6B" />
      </g>
    </>
  );
}

function NightDarkHeader() {
  return (
    <>
      {/* Crescent moon */}
      <circle cx="168" cy="18" r="16" fill="#A0A0A0" opacity="0.42" />
      <circle cx="160" cy="15" r="14" fill="#141414" />
      {/* Stars */}
      <circle cx="30" cy="12" r="2" fill="#A0A0A0" opacity="0.50" />
      <circle cx="55" cy="8" r="1.5" fill="#C8C8C8" opacity="0.45" />
      <circle cx="85" cy="22" r="2.5" fill="#A0A0A0" opacity="0.40" />
      <circle cx="115" cy="10" r="1.8" fill="#C8C8C8" opacity="0.50" />
      <circle cx="140" cy="30" r="1.5" fill="#A0A0A0" opacity="0.35" />
      <circle cx="45" cy="40" r="2" fill="#C8C8C8" opacity="0.30" />
      {/* City skyline silhouette */}
      <g transform="translate(8,20)" opacity="0.28">
        <rect x="0" y="20" width="8" height="30" fill="#A0A0A0" />
        <rect x="10" y="10" width="10" height="40" fill="#C8C8C8" />
        <rect x="22" y="16" width="7" height="34" fill="#A0A0A0" />
        <rect x="31" y="5" width="6" height="45" fill="#C8C8C8" />
        <rect x="39" y="18" width="9" height="32" fill="#A0A0A0" />
      </g>
      {/* Window lights */}
      <rect x="14" y="22" width="2" height="2" fill="#A0A0A0" opacity="0.40" />
      <rect x="18" y="16" width="2" height="2" fill="#C8C8C8" opacity="0.35" />
      <rect x="34" y="12" width="2" height="2" fill="#A0A0A0" opacity="0.40" />
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
    'forest-light': <ForestLightHeader />,
    'forest-dark': <ForestDarkHeader />,
    'sakura-light': <SakuraLightHeader />,
    'sakura-dark': <SakuraDarkHeader />,
    'night-light': <NightLightHeader />,
    'night-dark': <NightDarkHeader />,
  };

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

function ForestLightDivider() {
  return (
    <g opacity="0.42">
      {/* Leaf shapes */}
      <path d="M18 12 Q22 6 26 12 Q22 10 18 12Z" fill="#4A8C5C" />
      <path d="M48 10 Q52 4 56 10 Q52 8 48 10Z" fill="#5A9C6C" />
      <path d="M78 14 Q82 8 86 14 Q82 12 78 14Z" fill="#4A8C5C" />
      <path d="M105 9 Q109 3 113 9 Q109 7 105 9Z" fill="#5A9C6C" />
      {/* Tiny fern dot */}
      <circle cx="36" cy="12" r="1.5" fill="#3D7A4E" opacity="0.60" />
      <circle cx="95" cy="11" r="1.5" fill="#3D7A4E" opacity="0.60" />
    </g>
  );
}

function ForestDarkDivider() {
  return (
    <>
      {/* Fireflies */}
      <circle cx="16" cy="12" r="2.5" fill="#B0E890" opacity="0.40" />
      <circle cx="16" cy="12" r="5" fill="#B0E890" opacity="0.10" />
      <circle cx="42" cy="8" r="1.5" fill="#FFD080" opacity="0.38" />
      <circle cx="65" cy="14" r="2" fill="#B0E890" opacity="0.35" />
      <circle cx="65" cy="14" r="4.5" fill="#B0E890" opacity="0.10" />
      <circle cx="90" cy="10" r="1.8" fill="#FFD080" opacity="0.40" />
      <circle cx="110" cy="13" r="1.5" fill="#FFF4C0" opacity="0.32" />
    </>
  );
}

function SakuraLightDivider() {
  return (
    <g opacity="0.42">
      <ellipse cx="20" cy="10" rx="2.5" ry="3.5" fill="#D4708A" transform="rotate(30 20 10)" />
      <ellipse cx="45" cy="14" rx="2" ry="3" fill="#E888A0" transform="rotate(-20 45 14)" />
      <ellipse cx="72" cy="8" rx="2.5" ry="3.5" fill="#D4708A" transform="rotate(40 72 8)" />
      <ellipse cx="98" cy="13" rx="2" ry="3" fill="#E888A0" transform="rotate(-30 98 13)" />
    </g>
  );
}

function SakuraDarkDivider() {
  return (
    <>
      <circle cx="18" cy="12" r="2.5" fill="#FFD080" opacity="0.40" />
      <circle cx="18" cy="12" r="5" fill="#FFD080" opacity="0.08" />
      <circle cx="44" cy="8" r="1.5" fill="#FFF4C0" opacity="0.36" />
      <circle cx="68" cy="14" r="2" fill="#E888A0" opacity="0.35" />
      <circle cx="68" cy="14" r="4.5" fill="#E888A0" opacity="0.08" />
      <circle cx="92" cy="10" r="2" fill="#FFD080" opacity="0.42" />
      <circle cx="112" cy="15" r="1.5" fill="#FFF4C0" opacity="0.30" />
    </>
  );
}

function NightLightDivider() {
  return (
    <>
      {/* Subtle star dots */}
      <circle cx="18" cy="12" r="1.8" fill="#6B6B6B" opacity="0.42" />
      <circle cx="40" cy="8" r="1.5" fill="#8C8C8C" opacity="0.38" />
      <circle cx="62" cy="14" r="2" fill="#6B6B6B" opacity="0.38" />
      <circle cx="84" cy="9" r="1.5" fill="#8C8C8C" opacity="0.40" />
      <circle cx="106" cy="13" r="1.8" fill="#6B6B6B" opacity="0.35" />
    </>
  );
}

function NightDarkDivider() {
  return (
    <>
      {/* Glowing star dots */}
      <circle cx="16" cy="12" r="2" fill="#A0A0A0" opacity="0.45" />
      <circle cx="16" cy="12" r="4.5" fill="#A0A0A0" opacity="0.10" />
      <circle cx="42" cy="8" r="1.5" fill="#C8C8C8" opacity="0.40" />
      <circle cx="65" cy="14" r="2.5" fill="#A0A0A0" opacity="0.40" />
      <circle cx="65" cy="14" r="5" fill="#A0A0A0" opacity="0.08" />
      <circle cx="90" cy="10" r="1.8" fill="#C8C8C8" opacity="0.42" />
      <circle cx="110" cy="14" r="2" fill="#A0A0A0" opacity="0.35" />
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
    'forest-light': <ForestLightDivider />,
    'forest-dark': <ForestDarkDivider />,
    'sakura-light': <SakuraLightDivider />,
    'sakura-dark': <SakuraDarkDivider />,
    'night-light': <NightLightDivider />,
    'night-dark': <NightDarkDivider />,
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

function ForestLightFooter() {
  return (
    <>
      {/* Mountain range */}
      <path d="M0 60 L60 20 L120 60Z" fill="#4A8C5C" opacity="0.30" />
      <path d="M80 60 L160 10 L240 60Z" fill="#3D7A4E" opacity="0.25" />
      <path d="M200 60 L280 22 L360 60Z" fill="#4A8C5C" opacity="0.28" />
      {/* Snow caps */}
      <path d="M160 10 L150 22 L170 22Z" fill="#E8E8E0" opacity="0.28" />
      {/* Pine tree line */}
      <g opacity="0.35">
        <polygon points="310,60 318,38 326,60" fill="#4A8C5C" />
        <polygon points="340,60 347,42 354,60" fill="#5A9C6C" />
        <polygon points="365,60 371,45 377,60" fill="#4A8C5C" />
      </g>
    </>
  );
}

function ForestDarkFooter() {
  return (
    <>
      {/* Mountain silhouettes */}
      <path d="M0 60 L60 22 L120 60Z" fill="#4A8C5C" opacity="0.22" />
      <path d="M80 60 L160 12 L240 60Z" fill="#3D7A4E" opacity="0.18" />
      <path d="M200 60 L280 25 L360 60Z" fill="#4A8C5C" opacity="0.20" />
      {/* Pine tree silhouettes */}
      <g opacity="0.25">
        <polygon points="320,60 328,40 336,60" fill="#5A9C6C" />
        <polygon points="350,60 356,44 362,60" fill="#4A8C5C" />
      </g>
      {/* Stars */}
      <circle cx="60" cy="10" r="2" fill="#FFD080" opacity="0.44" />
      <circle cx="200" cy="6" r="2.5" fill="#FFF4C0" opacity="0.38" />
      <circle cx="320" cy="12" r="1.8" fill="#FFD080" opacity="0.36" />
    </>
  );
}

function SakuraLightFooter() {
  return (
    <>
      {/* Cherry blossom tree line */}
      <g opacity="0.35">
        <circle cx="60" cy="28" r="22" fill="#D4708A" opacity="0.35" />
        <rect x="57" y="40" width="6" height="20" fill="#8B6040" opacity="0.40" />
        <circle cx="160" cy="24" r="25" fill="#E888A0" opacity="0.30" />
        <rect x="157" y="40" width="6" height="20" fill="#8B6040" opacity="0.35" />
        <circle cx="280" cy="30" r="20" fill="#D4708A" opacity="0.32" />
        <rect x="277" y="42" width="6" height="18" fill="#8B6040" opacity="0.38" />
      </g>
      {/* Petal river */}
      <g opacity="0.30">
        <ellipse cx="100" cy="50" rx="3" ry="4" fill="#D4708A" transform="rotate(20 100 50)" />
        <ellipse cx="200" cy="48" rx="2.5" ry="3.5" fill="#E888A0" transform="rotate(-30 200 48)" />
        <ellipse cx="330" cy="52" rx="3" ry="4" fill="#D4708A" transform="rotate(15 330 52)" />
        <ellipse cx="380" cy="46" rx="2" ry="3" fill="#E888A0" transform="rotate(-20 380 46)" />
      </g>
    </>
  );
}

function SakuraDarkFooter() {
  return (
    <>
      {/* Tree silhouettes */}
      <g opacity="0.25">
        <circle cx="60" cy="30" r="20" fill="#D4708A" opacity="0.35" />
        <rect x="57" y="42" width="6" height="18" fill="#8B6040" opacity="0.30" />
        <circle cx="160" cy="26" r="22" fill="#E888A0" opacity="0.30" />
        <rect x="157" y="40" width="6" height="20" fill="#8B6040" opacity="0.28" />
        <circle cx="280" cy="32" r="18" fill="#D4708A" opacity="0.32" />
        <rect x="277" y="44" width="6" height="16" fill="#8B6040" opacity="0.30" />
      </g>
      {/* Stars */}
      <circle cx="80" cy="10" r="2" fill="#FFD080" opacity="0.42" />
      <circle cx="220" cy="8" r="2.5" fill="#FFF4C0" opacity="0.38" />
      <circle cx="340" cy="14" r="1.8" fill="#FFD080" opacity="0.36" />
      {/* Glowing petals */}
      <ellipse cx="120" cy="48" rx="2.5" ry="3.5" fill="#E888A0" opacity="0.25" transform="rotate(25 120 48)" />
      <ellipse cx="350" cy="44" rx="2" ry="3" fill="#D4708A" opacity="0.22" transform="rotate(-20 350 44)" />
    </>
  );
}

function NightLightFooter() {
  return (
    <>
      {/* City skyline silhouette */}
      <g opacity="0.28">
        <rect x="0" y="30" width="30" height="30" fill="#6B6B6B" />
        <rect x="32" y="20" width="20" height="40" fill="#8C8C8C" />
        <rect x="54" y="26" width="16" height="34" fill="#6B6B6B" />
        <rect x="72" y="14" width="14" height="46" fill="#8C8C8C" />
        <rect x="88" y="24" width="18" height="36" fill="#6B6B6B" />
        <rect x="108" y="32" width="22" height="28" fill="#8C8C8C" />
        <rect x="132" y="18" width="16" height="42" fill="#6B6B6B" />
        <rect x="150" y="28" width="20" height="32" fill="#8C8C8C" />
        <rect x="172" y="22" width="14" height="38" fill="#6B6B6B" />
        <rect x="188" y="36" width="24" height="24" fill="#8C8C8C" />
        <rect x="214" y="16" width="18" height="44" fill="#6B6B6B" />
        <rect x="234" y="28" width="16" height="32" fill="#8C8C8C" />
        <rect x="252" y="20" width="20" height="40" fill="#6B6B6B" />
        <rect x="274" y="30" width="26" height="30" fill="#8C8C8C" />
        <rect x="302" y="18" width="14" height="42" fill="#6B6B6B" />
        <rect x="318" y="24" width="18" height="36" fill="#8C8C8C" />
        <rect x="338" y="34" width="22" height="26" fill="#6B6B6B" />
        <rect x="362" y="20" width="16" height="40" fill="#8C8C8C" />
        <rect x="380" y="28" width="20" height="32" fill="#6B6B6B" />
      </g>
      {/* Stars */}
      <circle cx="80" cy="10" r="2" fill="#6B6B6B" opacity="0.44" />
      <circle cx="200" cy="6" r="2.5" fill="#8C8C8C" opacity="0.38" />
      <circle cx="320" cy="12" r="1.8" fill="#6B6B6B" opacity="0.40" />
    </>
  );
}

function NightDarkFooter() {
  return (
    <>
      {/* City skyline silhouette */}
      <g opacity="0.22">
        <rect x="0" y="30" width="30" height="30" fill="#A0A0A0" />
        <rect x="32" y="20" width="20" height="40" fill="#C8C8C8" />
        <rect x="54" y="26" width="16" height="34" fill="#A0A0A0" />
        <rect x="72" y="14" width="14" height="46" fill="#C8C8C8" />
        <rect x="88" y="24" width="18" height="36" fill="#A0A0A0" />
        <rect x="108" y="32" width="22" height="28" fill="#C8C8C8" />
        <rect x="132" y="18" width="16" height="42" fill="#A0A0A0" />
        <rect x="150" y="28" width="20" height="32" fill="#C8C8C8" />
        <rect x="172" y="22" width="14" height="38" fill="#A0A0A0" />
        <rect x="188" y="36" width="24" height="24" fill="#C8C8C8" />
        <rect x="214" y="16" width="18" height="44" fill="#A0A0A0" />
        <rect x="234" y="28" width="16" height="32" fill="#C8C8C8" />
        <rect x="252" y="20" width="20" height="40" fill="#A0A0A0" />
        <rect x="274" y="30" width="26" height="30" fill="#C8C8C8" />
        <rect x="302" y="18" width="14" height="42" fill="#A0A0A0" />
        <rect x="318" y="24" width="18" height="36" fill="#C8C8C8" />
        <rect x="338" y="34" width="22" height="26" fill="#A0A0A0" />
        <rect x="362" y="20" width="16" height="40" fill="#C8C8C8" />
        <rect x="380" y="28" width="20" height="32" fill="#A0A0A0" />
      </g>
      {/* Stars */}
      <circle cx="70" cy="10" r="2" fill="#A0A0A0" opacity="0.48" />
      <circle cx="190" cy="6" r="2.5" fill="#C8C8C8" opacity="0.42" />
      <circle cx="310" cy="12" r="1.8" fill="#A0A0A0" opacity="0.44" />
      {/* Window lights */}
      <rect x="76" y="22" width="2" height="2" fill="#C8C8C8" opacity="0.35" />
      <rect x="136" y="24" width="2" height="2" fill="#A0A0A0" opacity="0.38" />
      <rect x="216" y="22" width="2" height="2" fill="#C8C8C8" opacity="0.35" />
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
    'forest-light': <ForestLightFooter />,
    'forest-dark': <ForestDarkFooter />,
    'sakura-light': <SakuraLightFooter />,
    'sakura-dark': <SakuraDarkFooter />,
    'night-light': <NightLightFooter />,
    'night-dark': <NightDarkFooter />,
  };

  return (
    <div style={{ margin: '0 -16px', overflow: 'hidden' }} aria-hidden="true">
      <svg
        viewBox="0 0 400 60"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', maxHeight: '80px', display: 'block' }}
      >
        {content[key]}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// NavArt
// ─────────────────────────────────────────────

function getNavContent(theme: string, dark: boolean): React.ReactNode {
  const key = `${theme}-${dark ? 'dark' : 'light'}`;
  switch (key) {
    case 'sun-light':
      return (
        <>
          {/* Small sun */}
          <circle cx="65" cy="12" r="8" fill="#F47B5E" opacity="0.6" />
          <g stroke="#F47B5E" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <line x1="65" y1="1" x2="65" y2="4" />
            <line x1="65" y1="20" x2="65" y2="23" />
            <line x1="54" y1="12" x2="57" y2="12" />
            <line x1="73" y1="12" x2="76" y2="12" />
          </g>
          {/* Small cloud */}
          <ellipse cx="25" cy="10" rx="12" ry="5" fill="#4A9EBF" opacity="0.3" />
        </>
      );
    case 'sun-dark':
      return (
        <>
          {/* Small crescent moon */}
          <circle cx="62" cy="12" r="9" fill="#FFD080" opacity="0.5" />
          <circle cx="58" cy="10" r="7.5" fill="#1E1A16" />
          {/* Stars */}
          <circle cx="30" cy="8" r="1.5" fill="#FFD080" opacity="0.5" />
          <circle cx="45" cy="18" r="1.2" fill="#FFF4C0" opacity="0.5" />
        </>
      );
    case 'sky-light':
      return (
        <>
          {/* Small cloud */}
          <ellipse cx="45" cy="10" rx="14" ry="6" fill="#2870A0" opacity="0.3" />
          {/* Seagull */}
          <path d="M20 14 Q24 9 28 14 Q32 9 36 14" stroke="#2870A0" fill="none" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </>
      );
    case 'sky-dark':
      return (
        <>
          {/* Small crescent moon */}
          <circle cx="62" cy="12" r="9" fill="#E0E8FF" opacity="0.4" />
          <circle cx="58" cy="10" r="7.5" fill="#161C20" />
          {/* Stars */}
          <circle cx="28" cy="8" r="1.5" fill="#B0D0FF" opacity="0.5" />
          <circle cx="42" cy="18" r="1.2" fill="#B0D0FF" opacity="0.5" />
        </>
      );
    case 'zen-light':
      return (
        <>
          {/* Small cherry blossoms */}
          <circle cx="30" cy="10" r="5" fill="#E8A0A0" opacity="0.5" />
          <circle cx="50" cy="14" r="5" fill="#E8A0A0" opacity="0.5" />
          {/* Small petal */}
          <ellipse cx="65" cy="10" rx="3" ry="4.5" fill="#F0B0B0" transform="rotate(20 65 10)" opacity="0.4" />
        </>
      );
    case 'zen-dark':
      return (
        <>
          {/* Fireflies */}
          <circle cx="28" cy="10" r="2.5" fill="#FFD080" opacity="0.4" />
          <circle cx="28" cy="10" r="5" fill="#FFD080" opacity="0.12" />
          <circle cx="48" cy="15" r="2.5" fill="#FFD080" opacity="0.4" />
          <circle cx="48" cy="15" r="5" fill="#FFD080" opacity="0.12" />
          {/* Star */}
          <circle cx="65" cy="8" r="1.5" fill="#FFF4C0" opacity="0.5" />
        </>
      );
    case 'forest-light':
      return (
        <>
          {/* Small pine tree */}
          <g transform="translate(25,2)" opacity="0.5">
            <polygon points="0,20 8,0 16,20" fill="#4A8C5C" />
            <rect x="6" y="20" width="4" height="4" fill="#8B6914" />
          </g>
          {/* Leaf */}
          <path d="M55 12 Q59 6 63 12 Q59 10 55 12Z" fill="#5A9C6C" opacity="0.5" />
        </>
      );
    case 'forest-dark':
      return (
        <>
          {/* Firefly */}
          <circle cx="30" cy="10" r="2.5" fill="#B0E890" opacity="0.4" />
          <circle cx="30" cy="10" r="5" fill="#B0E890" opacity="0.12" />
          {/* Stars */}
          <circle cx="50" cy="8" r="1.5" fill="#FFD080" opacity="0.5" />
          <circle cx="65" cy="16" r="1.2" fill="#FFF4C0" opacity="0.5" />
        </>
      );
    case 'sakura-light':
      return (
        <>
          {/* Small cherry blossoms */}
          <circle cx="28" cy="10" r="5" fill="#D4708A" opacity="0.5" />
          <circle cx="48" cy="14" r="5" fill="#E888A0" opacity="0.45" />
          {/* Petal */}
          <ellipse cx="65" cy="10" rx="3" ry="4.5" fill="#D4708A" transform="rotate(20 65 10)" opacity="0.4" />
        </>
      );
    case 'sakura-dark':
      return (
        <>
          {/* Fireflies */}
          <circle cx="30" cy="10" r="2.5" fill="#FFD080" opacity="0.4" />
          <circle cx="30" cy="10" r="5" fill="#FFD080" opacity="0.12" />
          <circle cx="50" cy="16" r="2" fill="#E888A0" opacity="0.35" />
          {/* Star */}
          <circle cx="65" cy="8" r="1.5" fill="#FFF4C0" opacity="0.5" />
        </>
      );
    case 'night-light':
      return (
        <>
          {/* Stars */}
          <circle cx="28" cy="10" r="1.5" fill="#6B6B6B" opacity="0.5" />
          <circle cx="44" cy="16" r="1.2" fill="#8C8C8C" opacity="0.45" />
          {/* Small crescent */}
          <circle cx="62" cy="12" r="7" fill="#6B6B6B" opacity="0.35" />
          <circle cx="59" cy="10" r="5.5" fill="#F5F5F5" />
        </>
      );
    case 'night-dark':
      return (
        <>
          {/* Stars */}
          <circle cx="28" cy="8" r="1.8" fill="#A0A0A0" opacity="0.5" />
          <circle cx="48" cy="16" r="1.5" fill="#C8C8C8" opacity="0.45" />
          {/* Small crescent */}
          <circle cx="65" cy="12" r="7" fill="#A0A0A0" opacity="0.40" />
          <circle cx="62" cy="10" r="5.5" fill="#141414" />
        </>
      );
    default:
      return null;
  }
}

export function NavArt({ theme, dark }: ThemeArtProps) {
  return (
    <div style={{ position: 'absolute', right: 12, top: 0, height: '100%', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const, opacity: 0.3 }} aria-hidden="true">
      <svg viewBox="0 0 80 24" style={{ height: 24, width: 'auto' }} xmlns="http://www.w3.org/2000/svg">
        {getNavContent(theme, dark)}
      </svg>
    </div>
  );
}
