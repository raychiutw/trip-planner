/**
 * LandingPage — 未登入首頁（`/`）
 *
 * 為什麼需要：改版前 `/` 落到 `path="*"` → LegacyRedirect → `/trips` → `/login`，
 * 未登入訪客直接被丟到登入頁，完全不知道這個 app 是做什麼的。
 * Google Play 上架也需要一個能說明功能的落地頁。
 *
 * 視覺 SoT：`docs/design-sessions/2026-07-20-landing-page-FINAL-variantB.html`
 * （owner 於三版比較後選定變體 B — SVG 插畫導向）
 *
 * ⚠ 插畫必須是 **inline SVG**，不可改用 `<img>`。
 *   選變體 B 的整個理由就是「零圖片檔」—— DESIGN.md L284「全站不做 POI 照片 /
 *   artwork / 縮圖」。一旦引入圖片檔就變成專案第一批圖片資產，且要維護深/淺色兩套、
 *   UI 改版就過期。SVG 用 token 上色，深色模式自動跟著變。
 */
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';

const SCOPED_STYLES = `
.tp-lp{background:var(--color-background);color:var(--color-foreground);min-height:100dvh}

/* ── 頂列 ── */
.tp-lp-nav{
  position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;
  padding:12px 18px;
  background:color-mix(in srgb,var(--color-background) 88%,transparent);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
  border-bottom:1px solid var(--color-border);
}
.tp-lp-brand{font-size:18px;font-weight:800;letter-spacing:-.02em}
.tp-lp-brand span{color:var(--color-accent-text)}
.tp-lp-nav-spacer{flex:1}
.tp-lp-nav-login{
  font-size:15px;font-weight:700;text-decoration:none;color:var(--color-accent-text);
  min-height:44px;padding:0 16px;display:inline-flex;align-items:center;
  border-radius:var(--radius-full);
}
.tp-lp-nav-login:hover{background:var(--color-hover)}
.tp-lp-nav-login:focus-visible{outline:none;box-shadow:var(--shadow-ring)}

/* ── Hero ── */
.tp-lp-hero{padding:36px 18px 12px;max-width:1160px;margin:0 auto}
.tp-lp-eyebrow{
  font-size:var(--font-size-caption2);font-weight:800;letter-spacing:.16em;
  text-transform:uppercase;color:var(--color-accent-text);margin-bottom:12px;
}
.tp-lp-h1{
  font-size:clamp(30px,7vw,34px);line-height:1.2;font-weight:900;
  margin:0 0 14px;letter-spacing:-.03em;
}
.tp-lp-h1 em{font-style:normal;color:var(--color-accent-text)}
.tp-lp-sub{font-size:var(--font-size-body);line-height:1.7;color:var(--color-muted);margin:0 0 26px;max-width:50ch}
.tp-lp-cta-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.tp-lp-cta{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:52px;padding:0 26px;border-radius:var(--radius-full);
  background:var(--color-accent-fill);color:var(--color-accent-foreground);
  font-size:var(--font-size-callout);font-weight:700;text-decoration:none;border:none;cursor:pointer;
  box-shadow:var(--shadow-md);
  transition:filter var(--transition-duration-fast) var(--transition-timing-function-apple);
}
.tp-lp-cta:hover{filter:brightness(var(--hover-brightness))}
.tp-lp-cta:focus-visible{outline:none;box-shadow:var(--shadow-ring),var(--shadow-md)}
.tp-lp-hero-visual{margin-top:28px}
.tp-lp-art{width:100%;height:auto;max-width:460px;margin:0 auto;display:block}

/* ── 功能區 ── */
.tp-lp-features{padding:44px 18px;max-width:1160px;margin:0 auto}
.tp-lp-sec-title{font-size:var(--font-size-title3);font-weight:800;margin:0 0 8px;letter-spacing:-.02em}
.tp-lp-sec-sub{font-size:var(--font-size-callout);color:var(--color-muted);margin:0 0 26px;max-width:54ch}
.tp-lp-grid{display:grid;grid-template-columns:1fr;gap:16px}
.tp-lp-card{
  border:1px solid var(--color-border);border-radius:var(--radius-lg);
  background:var(--color-secondary);padding:20px;overflow:hidden;
}
.tp-lp-card-art{width:100%;height:auto;display:block;margin-bottom:16px;border-radius:var(--radius-md)}
.tp-lp-card h3{font-size:var(--font-size-callout);font-weight:700;margin:0 0 7px;letter-spacing:-.01em}
.tp-lp-card p{font-size:var(--font-size-subheadline);line-height:1.65;color:var(--color-muted);margin:0}

/* ── 收尾 CTA ── */
.tp-lp-close{padding:44px 18px;max-width:1160px;margin:0 auto;text-align:center}
.tp-lp-close-inner{
  border:1px solid var(--color-border);border-radius:var(--radius-xl);
  background:var(--color-secondary);padding:34px 22px;
}
.tp-lp-close h2{font-size:var(--font-size-title3);font-weight:800;margin:0 0 10px;letter-spacing:-.02em}
.tp-lp-close p{font-size:var(--font-size-callout);color:var(--color-muted);margin:0 0 22px}

/* ── 頁尾 ── */
.tp-lp-foot{
  border-top:1px solid var(--color-border);padding:24px 18px 34px;
  max-width:1160px;margin:0 auto;
  display:flex;gap:8px 20px;flex-wrap:wrap;align-items:center;
  font-size:var(--font-size-footnote);color:var(--color-muted);
}
.tp-lp-foot a{
  color:var(--color-accent-text);text-decoration:none;
  min-height:44px;display:inline-flex;align-items:center;
}
.tp-lp-foot a:hover{text-decoration:underline}
.tp-lp-foot-spacer{flex:1}

/* ── 桌機 ≥761px（同一份 component，非兩套）── */
@media (min-width:761px){
  .tp-lp-nav{padding:14px 40px}
  .tp-lp-hero{
    padding:76px 40px 24px;
    display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center;
  }
  .tp-lp-h1{font-size:clamp(40px,4.4vw,52px)}
  .tp-lp-hero-visual{margin-top:0}
  .tp-lp-features{padding:76px 40px}
  .tp-lp-grid{grid-template-columns:repeat(3,1fr);gap:20px}
  .tp-lp-close{padding:64px 40px}
  .tp-lp-close-inner{padding:48px 40px}
  .tp-lp-foot{padding:30px 40px 44px}
}
`;

export default function LandingPage() {
  const { user } = useCurrentUser();

  // 已登入者不該看到行銷頁。undefined = 還在載入，先不動（避免閃一下行銷頁再跳走）。
  if (user) return <Navigate to="/trips" replace />;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-lp" data-testid="landing-page">
        <nav className="tp-lp-nav">
          <div className="tp-lp-brand">Trip<span>line</span></div>
          <div className="tp-lp-nav-spacer" />
          <a className="tp-lp-nav-login" href="/login">登入</a>
        </nav>

        <header className="tp-lp-hero">
          <div className="tp-lp-hero-copy">
            <div className="tp-lp-eyebrow">旅遊行程規劃</div>
            <h1 className="tp-lp-h1">行程排壞了，<br /><em>講一句話</em>就好</h1>
            <p className="tp-lp-sub">
              「第二天下午排太趕」——說出來，行程自己調整，還會告訴你動了哪些點、車程差多少。
              不用一格一格拖。
            </p>
            <div className="tp-lp-cta-row">
              <a className="tp-lp-cta" href="/login">登入後開始使用</a>
            </div>
          </div>

          <div className="tp-lp-hero-visual">
            {/* 路線串起停留點 + 一句調整指令；虛線圈與箭頭表示「這個點被移走了」 */}
            <svg
              className="tp-lp-art"
              viewBox="0 0 440 330"
              fill="none"
              role="img"
              aria-label="行程路線示意圖：四個停留點被一條路線串起，上方是一句調整行程的指令"
            >
              <path
                d="M46 282 C 104 282, 100 214, 158 210 S 232 150, 288 142 S 366 82, 400 66"
                stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray="8 8" opacity=".5"
              />
              <circle cx="46" cy="282" r="15" fill="var(--d1)" />
              <circle cx="158" cy="210" r="15" fill="var(--d2)" />
              <circle cx="288" cy="142" r="15" fill="var(--d3)" />
              <circle cx="400" cy="66" r="15" fill="var(--d4)" />
              <text x="46" y="288" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">1</text>
              <text x="158" y="216" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">2</text>
              <text x="288" y="148" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">3</text>
              <text x="400" y="72" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">4</text>
              <rect x="70" y="24" width="238" height="62" rx="20" fill="var(--color-accent-fill)" />
              <path d="M96 86 L110 86 L96 102 Z" fill="var(--color-accent-fill)" />
              <text x="92" y="52" fontSize="15" fontWeight="700" fill="var(--color-accent-foreground)">第二天下午</text>
              <text x="92" y="74" fontSize="15" fontWeight="700" fill="var(--color-accent-foreground)">排鬆一點</text>
              <circle cx="222" cy="188" r="11" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="4 4" opacity=".55" />
              <path d="M232 182 L272 152" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" opacity=".55" />
              <path d="M272 152 l-9 1 l4 6 Z" fill="var(--color-muted)" opacity=".55" />
            </svg>
          </div>
        </header>

        <section className="tp-lp-features">
          <h2 className="tp-lp-sec-title">出發前你會反覆做的三件事</h2>
          <p className="tp-lp-sec-sub">不是功能清單，是實際會發生的事。</p>

          <div className="tp-lp-grid">
            <article className="tp-lp-card">
              <svg className="tp-lp-card-art" viewBox="0 0 240 116" fill="none" role="img" aria-label="對話示意：使用者訊息與系統回覆各一則">
                <rect x="12" y="16" width="132" height="34" rx="17" fill="var(--color-tertiary)" />
                <rect x="28" y="29" width="88" height="8" rx="4" fill="var(--color-muted)" opacity=".45" />
                <rect x="96" y="66" width="132" height="34" rx="17" fill="var(--color-accent-fill)" />
                <rect x="112" y="79" width="72" height="8" rx="4" fill="var(--color-accent-foreground)" opacity=".85" />
                <rect x="190" y="79" width="22" height="8" rx="4" fill="var(--color-accent-foreground)" opacity=".5" />
              </svg>
              <h3>說一句話就改好</h3>
              <p>講「第三天太趕」，它會動點、重算車程，然後告訴你改了什麼。不用自己一格一格拖。</p>
            </article>

            <article className="tp-lp-card">
              <svg className="tp-lp-card-art" viewBox="0 0 240 116" fill="none" role="img" aria-label="地圖示意：兩條不同顏色的每日路線">
                <path d="M18 94 C 62 94, 58 52, 102 50 S 168 26, 224 32" stroke="var(--d2)" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M18 102 C 74 102, 74 74, 130 74 S 194 62, 224 66" stroke="var(--d3)" strokeWidth="3.5" strokeLinecap="round" opacity=".75" />
                <circle cx="18" cy="94" r="7" fill="var(--d2)" />
                <circle cx="102" cy="50" r="7" fill="var(--d2)" />
                <circle cx="224" cy="32" r="7" fill="var(--d2)" />
                <circle cx="130" cy="74" r="6" fill="var(--d3)" opacity=".75" />
              </svg>
              <h3>每天的路線一眼看完</h3>
              <p>每日一色的路線圖，馬上看出哪天在繞路。可切一般圖或衛星圖。</p>
            </article>

            <article className="tp-lp-card">
              <svg className="tp-lp-card-art" viewBox="0 0 240 116" fill="none" role="img" aria-label="健檢示意：三條進度條，其中一條偏短代表有問題">
                <rect x="24" y="24" width="192" height="14" rx="7" fill="var(--color-tertiary)" />
                <rect x="24" y="24" width="150" height="14" rx="7" fill="var(--d3)" />
                <rect x="24" y="51" width="192" height="14" rx="7" fill="var(--color-tertiary)" />
                <rect x="24" y="51" width="78" height="14" rx="7" fill="var(--d1)" />
                <rect x="24" y="78" width="192" height="14" rx="7" fill="var(--color-tertiary)" />
                <rect x="24" y="78" width="176" height="14" rx="7" fill="var(--d3)" />
              </svg>
              <h3>出發前先健檢</h3>
              <p>時間排太緊、來回繞路、營業時間對不上——五個維度掃一遍，出發前就知道。</p>
            </article>
          </div>
        </section>

        <section className="tp-lp-close">
          <div className="tp-lp-close-inner">
            <h2>行程還在試算表裡？</h2>
            <p>登入後就能開始排，也可以把既有行程用 JSON 匯入。</p>
            <a className="tp-lp-cta" href="/login">登入後開始使用</a>
          </div>
        </section>

        <footer className="tp-lp-foot">
          <span>© 2026 Tripline</span>
          <div className="tp-lp-foot-spacer" />
          <a href="/privacy">隱私權政策</a>
        </footer>
      </div>
    </>
  );
}
