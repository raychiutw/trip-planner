import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokensPath = resolve(__dirname, '../../css/tokens.css');

// ===== WCAG 2.x contrast algorithm =====
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
// https://www.w3.org/TR/WCAG21/#contrast-minimum
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const adjust = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

function contrastRatio(c1: string, c2: string): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

const AA_NORMAL = 4.5; // body text
const AA_LARGE = 3.0; // 18pt+/14pt+ bold text, also non-text UI (WCAG 1.4.11)

// 從 tokens.css 文字動態切出 light（@theme）與 dark（body.dark）兩個宣告區塊。
// 每個區塊內都沒有巢狀 `{`，non-greedy 到第一個 `}` 即為區塊真正結尾。
// `body.dark {` 選擇器在檔內出現不只一次（另有 composite token 如 --tabbar-tint 的
// override block），所以取「所有同名區塊」後，挑內含 --color-accent 宣告的那一個
// 才是真正的色票 override block；body.theme-print 的第三份色票宣告也不會被誤取，
// 因為 extractBlock 只回傳符合 headerHasMarker 條件的那一個 block。
function extractBlock(css: string, header: string, mustContain = '--color-accent:'): string {
  const re = new RegExp(`${header}\\s*\\{([\\s\\S]*?)\\}`, 'g');
  const blocks = [...css.matchAll(re)].map((m) => m[1]);
  const found = blocks.find((b) => b.includes(mustContain));
  if (!found) throw new Error(`tokens.css: 找不到含 ${mustContain} 的 ${header} 區塊`);
  return found;
}

// 對某個 block（light 或 dark）取出 --color-<name> 的實際 hex 值，不 hardcode。
// 找不到就直接 throw —— token 改名/刪除時要讓這個守衛炸掉，而不是靜默通過。
function getColor(block: string, name: string): string {
  const match = block.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`tokens.css: 找不到 --color-${name}`);
  return match[1].trim();
}

describe('tokens.css', () => {
  const tokens = readFileSync(tokensPath, 'utf-8');

  it('includes Tailwind imports', () => {
    expect(tokens).toContain('@import "tailwindcss/theme" layer(theme)');
    expect(tokens).toContain('@import "tailwindcss/utilities" layer(utilities)');
  });

  it('includes @theme block with all design tokens', () => {
    expect(tokens).toContain('@theme {');
    expect(tokens).toContain('--color-accent:');
    expect(tokens).toContain('--color-background:');
    expect(tokens).toContain('--radius-sm:');
    expect(tokens).toContain('--shadow-md:');
    expect(tokens).toContain('--spacing-4:');
    expect(tokens).toContain('--font-size-body:');
    expect(tokens).toContain('--font-family-system:');
    expect(tokens).toContain('--transition-duration-fast:');
  });

  it('Single-theme design system: dark + print, no legacy multi-theme blocks', () => {
    expect(tokens).toContain('body.dark {');
    expect(tokens).toContain('body.theme-print');
    expect(tokens).not.toContain('body.theme-sun');
    expect(tokens).not.toContain('body.theme-sky');
    expect(tokens).not.toContain('body.theme-zen');
    expect(tokens).not.toContain('body.theme-forest');
    expect(tokens).not.toContain('body.theme-sakura');
    expect(tokens).not.toContain('body.theme-night');
  });

  it('uses 柔褐 accent + cream background as default @theme', () => {
    expect(tokens).toMatch(/--color-accent:\s*#A97A4A/);
    expect(tokens).toMatch(/--color-background:\s*#FFFBF5/);
    expect(tokens).toMatch(/--color-foreground:\s*#2A1F18/);
  });

  it('loads Inter + Noto Sans TC primary font stack', () => {
    expect(tokens).toMatch(/--font-family-system:.*'Inter'.*'Noto Sans TC'/);
  });

  it('includes sheet animation tokens', () => {
    expect(tokens).toContain('--ease-spring:');
    expect(tokens).toContain('--duration-sheet-open:');
    expect(tokens).toContain('--duration-sheet-close:');
  });

  it('includes non-utility tokens (z-index, layout)', () => {
    expect(tokens).toContain('--z-sticky-nav:');
    expect(tokens).toContain('--spacing-nav-h:');
    expect(tokens).toContain('--spacing-tap-min:');
  });

  it('includes global reset', () => {
    expect(tokens).toContain('box-sizing: border-box');
    expect(tokens).toContain('font-family: var(--font-family-system)');
    expect(tokens).toContain('background: var(--color-background)');
  });

  it('does NOT include old V1 component classes', () => {
    expect(tokens).not.toContain('.request-item');
    expect(tokens).not.toContain('.chat-container');
    expect(tokens).not.toContain('.admin-');
    // keyframes 定義在 tokens.css (v2.31.71: stepper-pulse/tl-pulse 0 ref → 一併刪)
    expect(tokens).toContain('@keyframes toast-slide-down');
    expect(tokens).toContain('@keyframes toast-slide-up');
    expect(tokens).toContain('@keyframes shimmer');
  });

  it('includes page-level base styles (migrated from SCOPED_STYLES)', () => {
    expect(tokens).toContain('.day-header');
    // .info-panel 已隨 InfoPanel.tsx orphan 一起刪除（F001 cleanup）
    expect(tokens).not.toContain('.info-panel');
    expect(tokens).toContain('.trip-btn');
    // .color-mode-card 隨 AppearanceSettingsPage 主題色 section 一起刪除（v2.30.10）
    expect(tokens).not.toContain('.color-mode-card');
    expect(tokens).toContain('.skeleton-bone');
    expect(tokens).toContain('#tripContent section');
  });

  it('has essential token values', () => {
    const tokenAccent = tokens.match(/--color-accent:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenAccent).toBeTruthy();

    const tokenBody = tokens.match(/--font-size-body:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenBody).toBeTruthy();
  });

  // ===== WCAG AA contrast — 柔褐色盤 light/dark（#1153）=====
  // 色值全部從本檔已讀入的 `tokens` 文字動態抽出（見上方 extractBlock/getColor），
  // 不 hardcode fixture；斷言的是「目前實際被拿來當淺底上文字/UI 用途」的 pair。
  // accent 系列依用途分工，門檻不同（見 tokens.css 內對應註解）：
  //   --color-accent/-subtle/-bg/-deep  → 填色、邊框、裝飾用途，不當文字，這裡不斷言
  //   --color-accent-text(-on-tonal)    → 文字/連結專用較深變體 → AA_NORMAL
  //   --color-accent-fill + accent-foreground → 實心鈕文字 → AA_NORMAL
  //   --color-border-control             → 非文字 UI（輸入框/outline 鈕邊框）→ AA_LARGE
  describe('WCAG AA contrast — 動態解析 tokens.css', () => {
    const lightBlock = extractBlock(tokens, '@theme');
    const darkBlock = extractBlock(tokens, 'body\\.dark');

    describe('light theme', () => {
      const bg = getColor(lightBlock, 'background');
      const secondary = getColor(lightBlock, 'secondary');
      const tertiary = getColor(lightBlock, 'tertiary');
      const foreground = getColor(lightBlock, 'foreground');
      const muted = getColor(lightBlock, 'muted');
      const accentText = getColor(lightBlock, 'accent-text');
      const accentTextOnTonal = getColor(lightBlock, 'accent-text-on-tonal');
      const accentSubtle = getColor(lightBlock, 'accent-subtle');
      const accentBg = getColor(lightBlock, 'accent-bg');
      const accentFill = getColor(lightBlock, 'accent-fill');
      const accentForeground = getColor(lightBlock, 'accent-foreground');
      const borderControl = getColor(lightBlock, 'border-control');

      it('foreground / background ≥ 4.5（body text）', () => {
        expect(contrastRatio(foreground, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('foreground / secondary ≥ 4.5（body text on alt bg）', () => {
        expect(contrastRatio(foreground, secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('muted / background ≥ 4.5（secondary text）', () => {
        expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('muted / secondary ≥ 4.5（secondary text on alt bg）', () => {
        expect(contrastRatio(muted, secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / background ≥ 4.5（連結/選中標籤文字）', () => {
        expect(contrastRatio(accentText, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / secondary ≥ 4.5', () => {
        expect(contrastRatio(accentText, secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / accent-subtle ≥ 4.5（淡 tint 底上的文字）', () => {
        expect(contrastRatio(accentText, accentSubtle)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      // #1156：DESIGN.md §Color Approach 把「頁面／表面色」列為 accent-text 的適用底色，
      // 但 tertiary（recessed surface / input bg）與 hover 這兩個常見底色原本沒人守。
      // ⚠ accent-text / tertiary 目前只有 4.60，離門檻 4.5 只剩 0.10 —— 任何把 tertiary
      //   壓深的調整都會直接跌破。這兩條就是為了讓它出聲而不是靜默破線。
      it('accent-text / tertiary ≥ 4.5（recessed surface 上的文字）', () => {
        expect(contrastRatio(accentText, tertiary)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / hover ≥ 4.5（hover 底上的文字）', () => {
        expect(contrastRatio(accentText, getColor(lightBlock, 'hover'))).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      // #1156：DESIGN.md §Color Approach 允許「aria-hidden 純裝飾圖示」繼續用 --color-accent。
      // WCAG 1.4.11 對 pure decoration 是**明文例外**，所以這個 3:1 是自訂下限、不是法規門檻 ——
      // 但它是「圖示哪天不再是裝飾」時唯一的緩衝（那時 1.4.11 真的適用、門檻正好 3:1）。
      // 現值 3.24、只剩 0.24 餘裕，而原本沒有任何一層守著 —— call-site 守衛把那兩條規則放進白名單
      // 直接放行、axe 對 aria-hidden 與單字元都看不到。把 subtle 調亮一階就會靜默破線。
      it('accent / accent-subtle ≥ 3（裝飾圖示 3:1 例外的前提）', () => {
        expect(contrastRatio(getColor(lightBlock, 'accent'), accentSubtle)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      // 同理，DESIGN.md §Color Approach 的「邊框同理走 3:1」也是一句沒人守的規範主張。
      // .tp-trip-card:hover / .tp-trip-card-new:hover 的 border-color 就靠這幾組撐著，
      // 而 axe 對 border 對比本來就不掃。餘裕最小的是 hover（3.27）。
      it('accent / background ≥ 3（邊框：頁面底）', () => {
        expect(contrastRatio(getColor(lightBlock, 'accent'), bg)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('accent / secondary ≥ 3（邊框：alt 底，行程卡 hover 框）', () => {
        expect(contrastRatio(getColor(lightBlock, 'accent'), secondary)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('accent / hover ≥ 3（邊框：hover 底）', () => {
        expect(contrastRatio(getColor(lightBlock, 'accent'), getColor(lightBlock, 'hover'))).toBeGreaterThanOrEqual(AA_LARGE);
      });

      // 刻意「沒有」accent-text / accent-bg 這一條：實測 4.05 < 4.5，本來就不該用。
      // accent-bg 底上的文字規則指定走 --color-accent-text-on-tonal（下面那條）。

      it('accent-text-on-tonal / accent-subtle ≥ 4.5（tonal 底文字變體）', () => {
        expect(contrastRatio(accentTextOnTonal, accentSubtle)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text-on-tonal / accent-bg ≥ 4.5（較深 tonal 底文字變體）', () => {
        expect(contrastRatio(accentTextOnTonal, accentBg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-foreground / accent-fill ≥ 4.5（實心按鈕白字）', () => {
        expect(contrastRatio(accentForeground, accentFill)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('border-control / background ≥ 3（非文字 UI：輸入框/outline 邊框）', () => {
        expect(contrastRatio(borderControl, bg)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('border-control / secondary ≥ 3', () => {
        expect(contrastRatio(borderControl, secondary)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('border-control / tertiary ≥ 3', () => {
        expect(contrastRatio(borderControl, tertiary)).toBeGreaterThanOrEqual(AA_LARGE);
      });
    });

    describe('dark theme', () => {
      const bg = getColor(darkBlock, 'background');
      const secondary = getColor(darkBlock, 'secondary');
      const foreground = getColor(darkBlock, 'foreground');
      const muted = getColor(darkBlock, 'muted');
      const accentText = getColor(darkBlock, 'accent-text');
      const accentTextOnTonal = getColor(darkBlock, 'accent-text-on-tonal');
      const accentSubtle = getColor(darkBlock, 'accent-subtle');
      const accentBg = getColor(darkBlock, 'accent-bg');
      const accentFill = getColor(darkBlock, 'accent-fill');
      const accentForeground = getColor(darkBlock, 'accent-foreground');
      const borderControl = getColor(darkBlock, 'border-control');

      it('foreground / background ≥ 4.5（body text）', () => {
        expect(contrastRatio(foreground, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('muted / background ≥ 4.5（secondary text）', () => {
        expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / background ≥ 4.5（連結/選中標籤文字，深色本就用亮字變體）', () => {
        expect(contrastRatio(accentText, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      // 與 light 對稱補齊 —— 規則對這幾組底色不分主題，只守一半等於深色沒人管。
      // 深色那組灰階最近才整條往上抬過一階（v2.56.4 iOS system gray），再抬一次就會破線。
      it('accent-text / secondary ≥ 4.5', () => {
        expect(contrastRatio(accentText, secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / tertiary ≥ 4.5（recessed surface 上的文字）', () => {
        expect(contrastRatio(accentText, getColor(darkBlock, 'tertiary'))).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text / hover ≥ 4.5（hover 底上的文字）', () => {
        expect(contrastRatio(accentText, getColor(darkBlock, 'hover'))).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent / accent-subtle ≥ 3（裝飾圖示 3:1 例外的前提）', () => {
        expect(contrastRatio(getColor(darkBlock, 'accent'), accentSubtle)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      // 邊框 3:1 也要對稱 —— .tp-trip-card:hover 的 border-color 走的是不分主題的
      // var(--color-accent)，只在 light 守等於深色沒人管。dark 最薄的是 hover（3.82）。
      it('accent / background ≥ 3（邊框：頁面底）', () => {
        expect(contrastRatio(getColor(darkBlock, 'accent'), bg)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('accent / secondary ≥ 3（邊框：alt 底，行程卡 hover 框）', () => {
        expect(contrastRatio(getColor(darkBlock, 'accent'), secondary)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('accent / hover ≥ 3（邊框：hover 底）', () => {
        expect(contrastRatio(getColor(darkBlock, 'accent'), getColor(darkBlock, 'hover'))).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('accent-text-on-tonal / accent-subtle ≥ 4.5（tonal 底文字變體）', () => {
        expect(contrastRatio(accentTextOnTonal, accentSubtle)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-text-on-tonal / accent-bg ≥ 4.5（較深 tonal 底文字變體）', () => {
        expect(contrastRatio(accentTextOnTonal, accentBg)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('accent-foreground / accent-fill ≥ 4.5（實心按鈕深字，維持深色不壓深）', () => {
        expect(contrastRatio(accentForeground, accentFill)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it('border-control / background ≥ 3（非文字 UI）', () => {
        expect(contrastRatio(borderControl, bg)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it('border-control / secondary ≥ 3', () => {
        expect(contrastRatio(borderControl, secondary)).toBeGreaterThanOrEqual(AA_LARGE);
      });
    });

    describe('algorithm sanity', () => {
      it('純白 / 純黑 = 21:1（理論最大）', () => {
        expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
      });

      it('同色 ratio = 1', () => {
        expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 5);
      });
    });
  });

  // #1158: 全域 focus-visible 焦點框補回 + 守護測試
  // 任何 `:focus-visible { ... outline: none ... }` 規則若裸移除 outline，必須在同規則內
  // 提供可見的替代指示，不能兩手空空。
  //
  // ⚠ 2026-07-26（#1182）：本條原本把 `box-shadow: var(--shadow-ring)` 列為認可的替代方案。
  // 那個寫法已依 HIG 否決（「Rely on system-provided focus effects」—— `outline: none` 再自畫
  // 就是被勸阻的那一邊），`--shadow-ring` token 也已刪除。現在認可的替代只剩兩種，都是
  // DESIGN.md §Focus Indicator 明列的例外：表單輸入的 `border-color` 變化、清單／集合的
  // `background` highlight。要畫框請直接用 `outline` + 正的 `outline-offset`，那條走
  // tests/unit/focus-indicator.test.ts。
  it('every :focus-visible rule that resets outline: none also provides a visible focus indicator', () => {
    const ruleRegex = /([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g;
    const offendingSelectors: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = ruleRegex.exec(tokens)) !== null) {
      const selector = match[1].trim();
      const body = match[2];
      const resetsOutline = /outline:\s*none\s*;?/.test(body);
      const hasBorderColorAlternative = /border-color:\s*var\(/.test(body);
      const hasHighlightAlternative = /background(-color)?:\s*var\(/.test(body);

      if (resetsOutline && !hasBorderColorAlternative && !hasHighlightAlternative) {
        offendingSelectors.push(selector);
      }
    }

    expect(offendingSelectors).toEqual([]);
  });
});
