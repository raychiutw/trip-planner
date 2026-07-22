/**
 * owner 2026-07-22 回報的桌機 shell 視覺 4 項（v2.57.12 #1105 的 followup）。
 *
 * 四項都是「修了一個地方、漏掉兄弟」或「統一材質時推翻了原本的理由」，
 * 靜態斷言鎖住，避免下一輪統一 token 時再退回去。
 *
 * #1 day tab 可讀性 —— 2026-07-21 把 .tp-map-day-tabs 從 `secondary 88% + blur(14px)`
 *    統一成 --tabbar-*（dark tint alpha 僅 0.52）。但 tokens.css 自己的舊註解就寫過
 *    理由：「88%（比 nav 62% 略實）確保頂端 sticky、內容從下方流過時仍讀得出邊界，
 *    不重蹈先前 72% cream-on-cream」。統一時把這個理由推翻了 → prod 上 DAY 1-5 與底下
 *    entry 標題疊字。HIG 同義：navigation bar 的 scroll-edge material 比浮動 tab bar 實
 *    （頂欄背後永遠有內容流過，tab bar 沒有）。修法是給 day tabs 自己的 tint，
 *    blur/saturate 仍與 --tabbar-filter 同族（材質一致，不透明度分級）。
 *
 * #2 .tp-stack-mid 沒有任何 CSS 規則（只是 marker class）→ 中欄 TitleBar 與 TripPage
 *    portal 之間那段透出 .app-shell 的 base 深色，就是 owner 看到的「分隔線下方一塊黑」。
 *
 * #3 .trip-sheet-header 仍用 padding 撐高。#1105 只把 .tp-stack-head 改吃 --titlebar-h，
 *    漏了這個右欄 header（截圖裡「地圖 / 聊天」那條）→ 與中欄 TitleBar 不等高。
 *
 * #4 .tp-notes-section 的 overflow:hidden（給 accordion 裁圓角）會裁掉 .tp-date-popover
 *    （position:absolute）。z-index 救不了 overflow clipping → 月曆下半被切掉。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');
const TRIP_SHEET = readFileSync(join(__dirname, '../../src/components/trip/TripSheet.tsx'), 'utf8');
const NOTES = readFileSync(join(__dirname, '../../src/pages/TripNotesPage.tsx'), 'utf8');
const MAP_PAGE = readFileSync(join(__dirname, '../../src/pages/MapPage.tsx'), 'utf8');

/** 取某個 selector 的規則本體（第一個匹配的 { ... } 區塊）。 */
function ruleBody(css: string, selector: string): string {
  const idx = css.indexOf(selector + ' {');
  if (idx < 0) return '';
  const start = css.indexOf('{', idx);
  const end = css.indexOf('}', start);
  return css.slice(start + 1, end);
}

describe('#1 day tab 材質與底部 tab 維持同一組 token', () => {
  /*
   * 症狀是「透明度太高」，但 prod 實測後真因是 backdrop-filter 沒生效（見 #1b）。
   * 前綴修好、blur(28px) 真的作用之後，0.42/0.52 的低 tint 就完全讀得清 ——
   * 那也才是 iOS HIG 說的玻璃（低 tint + 強模糊；tint 一高 backdrop-filter 就沒
   * 表現空間）。所以這裡鎖住「不要為了遮症狀而分岔出第二組 tint」。
   */
  it('.tp-map-day-tabs 用 --tabbar-tint（與底部 tab、TitleBar 同一組）', () => {
    const body = ruleBody(TOKENS, '.tp-map-day-tabs');
    expect(body).toMatch(/background:\s*var\(--tabbar-tint\)/);
  });

  it('沒有分岔出 day-tabs 專用 tint', () => {
    expect(TOKENS).not.toMatch(/--daytabs-tint/);
  });
});

describe('#1b backdrop-filter 不能手寫 -webkit- 前綴（建置器去重會留錯那條）', () => {
  /*
   * prod 實測（2026-07-22，headed Chrome）：
   *   getComputedStyle('.tp-map-day-tabs').backdropFilter === "none"
   *   而 .tp-global-bottom-nav 的同一條宣告卻是 "blur(28px) saturate(1.9)"。
   *
   * 差別不在 CSS 寫法，在於有沒有經過建置器。抓 prod 的 index-*.css 看到：
   *   .tp-map-day-tabs{...;-webkit-backdrop-filter:var(--tabbar-filter);...}
   * 標準的 backdrop-filter **不見了**。tokens.css 原始碼兩條都有寫，lightningcss
   * 判定重複而去重，留下的是 -webkit- 那條。Tailwind 自己產生的 utility
   * （.backdrop-blur / .backdrop-filter）兩條都在，所以問題只發生在手寫規則。
   *
   * 後果比 owner 回報的大：tokens.css 裡**每一處**手寫玻璃（bottom-nav /
   * page-bottom-bar / day-tabs / TitleBar ×2）在 Chrome 上都沒生效過，
   * 只剩底下那層 tint 在撐。day tabs 因為是頂端 sticky、內容從下方流過，
   * 才最先被看出來。
   *
   * 修法：不要手寫前綴。專案 browserslist 是 "last 2 Chrome versions"
   * （見 package.json build script），lightningcss 會依 targets 自己決定要不要加。
   */
  it('tokens.css 不出現手寫的 -webkit-backdrop-filter 宣告', () => {
    // 只看宣告（行首就是該屬性）——註解裡提到這個名字是在解釋本 bug，不算違規。
    const hits = TOKENS.split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) => /^-webkit-backdrop-filter\s*:/.test(line));
    expect(hits).toEqual([]);
  });

  it('標準 backdrop-filter 宣告仍在（不是把整個效果刪掉）', () => {
    const decls = TOKENS.match(/^\s*backdrop-filter:/gm) ?? [];
    expect(decls.length).toBeGreaterThanOrEqual(5);
  });

  it('@supports 偵測仍同時檢查兩種寫法（fallback 判斷不受影響）', () => {
    // 這裡的 -webkit- 是在 @supports 條件式內做能力偵測，不是宣告，必須保留。
    expect(TOKENS).toMatch(/@supports not \(/);
  });
});

describe('#2 中欄 .tp-stack-mid 要有自己的表面色（TitleBar 下方不透出 base）', () => {
  it('tokens.css 有 .tp-stack-mid 規則（先前只是無樣式的 marker class）', () => {
    expect(TOKENS).toMatch(/\.tp-stack-mid\s*\{/);
  });

  it('.tp-stack-mid 用 --color-secondary（與 TripPage 的 .tp-trip-page-shell 同階）', () => {
    const body = ruleBody(TOKENS, '.tp-stack-mid');
    expect(body).toMatch(/background:\s*var\(--color-secondary\)/);
  });

  it('.tp-stack-mid 撐滿欄高，短內容時下方也不露 base', () => {
    const body = ruleBody(TOKENS, '.tp-stack-mid');
    expect(body).toMatch(/min-height:\s*100%/);
  });
});

describe('#3 .trip-sheet-header 與中欄 TitleBar 等高', () => {
  it('用 --titlebar-h 而非 padding 撐高', () => {
    expect(TRIP_SHEET).toMatch(/\.trip-sheet-header\s*\{[^}]*height:\s*calc\(var\(--titlebar-h\)/);
  });

  it('不再用原本的 padding: 12px 16px 撐高', () => {
    const m = TRIP_SHEET.match(/\.trip-sheet-header\s*\{([^}]*)\}/);
    expect(m?.[1]).not.toMatch(/padding:\s*12px 16px/);
  });
});

describe('#7 地圖模式的 Google POI 卡插槽水平置中（owner 2026-07-22）', () => {
  /*
   * `.map-page-cards` 是 absolute + left:0/right:0 撐滿寬度的底部插槽，行程 POI 卡
   * 在裡面是橫向捲動 strip、刻意 justify-content: flex-start（owner「夠寬靠左」）。
   * Google POI 卡只有單張，沿用同一插槽但改 display:block + max-width:420px ——
   * block 元素沒有 auto margin 就會貼左，跟旁邊那排靠左的行程卡對齊不上、
   * 在寬螢幕上尤其偏。owner 要的是「目前的顯示區域置中」。
   */
  it('.map-page-google-poi-slot 有 auto 水平邊距', () => {
    const m = MAP_PAGE.match(/\.map-page-google-poi-slot\s*\{([^}]*)\}/);
    expect(m?.[1]).toBeTruthy();
    expect(m?.[1]).toMatch(/margin-inline:\s*auto|margin:\s*0 auto|margin-left:\s*auto/);
  });

  it('仍保留 max-width（置中要有寬度上限才看得出來）', () => {
    const m = MAP_PAGE.match(/\.map-page-google-poi-slot\s*\{([^}]*)\}/);
    expect(m?.[1]).toMatch(/max-width:/);
  });

  it('不動到行程 POI 卡那排的靠左排列（owner 先前明確要求「夠寬靠左」）', () => {
    const m = MAP_PAGE.match(/\.map-page-cards\s*\{([^}]*)\}/);
    expect(m?.[1]).toMatch(/justify-content:\s*flex-start/);
  });
});

describe('#4 行程筆記的日期 popover 不被 accordion 裁掉', () => {
  it('.tp-notes-section 不再用 overflow: hidden 裁子內容', () => {
    const m = NOTES.match(/\.tp-notes-section\s*\{([^}]*)\}/);
    expect(m?.[1]).toBeTruthy();
    expect(m?.[1]).not.toMatch(/overflow:\s*hidden/);
  });

  it('圓角裁切改用 clip-path 之外的等效手段時，仍保留 border-radius 視覺', () => {
    const m = NOTES.match(/\.tp-notes-section\s*\{([^}]*)\}/);
    expect(m?.[1]).toMatch(/border-radius:/);
  });
});
