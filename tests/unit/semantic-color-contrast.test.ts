import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * 語意色（success / warning / destructive / info）當狀態標示時的組成守衛（#1176）。
 *
 * 規則來自 DESIGN.md §語意色的角色分離（2026-07-26 依 HIG 立）：
 *   底 = `--color-<tone>-bg` ／ **文字 = 中性色** ／ 顏色訊號 = `aria-hidden` 的 glyph
 *
 * HIG Color 逐字：「To emphasize primary actions, **apply color to the background rather than
 * to symbols or text.**」＋「**Avoid using the same color to mean different things.**」
 *
 * ⚠ **不要走「同色系淡底 + 同色系深字」再調色救對比。** 那是把一個色相同時當 fill 又當
 * label，正是上面第二段勸阻的；而且數字上也輸很多 —— 中性字實測 10.82–14.10，壓深的
 * 語意色字只有 4.59–4.60（剛好擦過 4.5，底色日後動一點就破線）。#1176 第一版就是先做成
 * `-deep` 才發現方向錯，這組守衛的存在就是不要再走回去。
 *
 * ⚠ 門檻用 **4.5**（WCAG 2.2 AA 一般文字）。HIG Accessibility 的表在「任何尺寸的 Bold」這格
 * 比 WCAG 寬（3:1），觸發本票的 `.tp-pill` 正是 11px Bold —— 但**寬鬆的一方不會把地板降
 * 下來**：repo 的 axe e2e 守衛實作的是 WCAG，2.35:1 也確實讀不動。HIG 作為 SoT 管的是
 * pattern 與設計語言，不是用來放寬 a11y 下限。
 *
 * ⚠ 反過來也不要加碼：`5.0` 在 HIG 與 WCAG 都不存在，不要拿「離 5.0 還差一點」推導出
 * 必須新造 token（#1176 最初就是這樣推錯的）。
 */

const root = resolve(__dirname, '../..');
const tokens = readFileSync(resolve(root, 'css/tokens.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const adj = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b);
}
function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** 取含 `--color-accent:` 的宣告區塊。淺色色票在 `@theme {}` 不在 `:root {}`。 */
function paletteBlock(header: string): string {
  const blocks = [...tokens.matchAll(new RegExp(`${header}\\s*\\{([\\s\\S]*?)\\}`, 'g'))].map((m) => m[1]);
  const found = blocks.find((b) => b.includes('--color-accent:'));
  if (!found) throw new Error(`tokens.css: 找不到含 --color-accent 的 ${header} 區塊`);
  return found;
}
function tokenValue(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`找不到 --${name}（或它不是 6 碼 hex）`);
  return m[1];
}

const AA_TEXT = 4.5;
const NON_TEXT = 3.0; // WCAG 1.4.11，給 aria-hidden glyph 用
const TONES = ['success', 'warning', 'info', 'destructive'] as const;
const THEMES = [
  { label: '淺色', header: '@theme' },
  { label: '深色', header: 'body\\.dark' },
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

describe('語意色狀態標示的組成守衛（#1176）', () => {
  describe('前提：-bg token 必須不透明', () => {
    // 半透明底會跟父層合成 → 同一顆 pill 在頁面底／卡片底／accent-subtle 列上得到三種
    // 合成色、三種對比（實測 4.60／4.36／4.12，只有第一種過關）。不透明底讓對比變成一個
    // 能在 tokens.css 算死的數字，而不是要逐個 call-site 追父層。
    // 這是下面所有數字的前提，所以放最前面。
    for (const { label, header } of THEMES) {
      it(`${label}：四個 -bg 都是 6 碼 hex`, () => {
        const block = paletteBlock(header);
        for (const tone of TONES) {
          const m = block.match(new RegExp(`--color-${tone}-bg:\\s*([^;]+);`));
          expect(m, `${label} 找不到 --color-${tone}-bg`).not.toBeNull();
          expect(m![1].trim(), `--color-${tone}-bg 是半透明，對比會隨父層漂移`)
            .toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    }
  });

  describe('中性字疊語意底 ≥ 4.5', () => {
    for (const { label, header } of THEMES) {
      it(`${label}：--color-foreground 在四個 -bg 上都達標`, () => {
        const block = paletteBlock(header);
        const fg = tokenValue(block, 'color-foreground');
        for (const tone of TONES) {
          const bg = tokenValue(block, `color-${tone}-bg`);
          const ratio = contrastRatio(fg, bg);
          expect(ratio, `${label} ${tone} 底上的中性字只有 ${ratio.toFixed(2)}:1`)
            .toBeGreaterThanOrEqual(AA_TEXT);
        }
      });
    }
  });

  describe('-deep 變體', () => {
    // 現況（2026-07-26）：`--color-success-deep` 只有一個 call-site —— `.tp-pw-check-ok`，
    // 而且它是**疊在頁面底色上的文字**（不是疊自家 -bg），所以走 4.5。
    // `--color-warning-deep` 目前**沒有任何 call-site**，下面那條是預防性的：DESIGN.md
    // §語意色的角色分離 把 -deep 列為顏色訊號 glyph 的合法選擇，先把值鎖在可用範圍，
    // 免得將來有人拿一個看不見的值去畫 glyph。**別把它讀成「正在保護線上的 UI」。**
    for (const { label, header } of THEMES) {
      it(`${label}：success-deep 當頁面底上的文字 ≥ 4.5（.tp-pw-check-ok）`, () => {
        const block = paletteBlock(header);
        const ratio = contrastRatio(tokenValue(block, 'color-success-deep'), tokenValue(block, 'color-background'));
        expect(ratio, `${label} success-deep 疊頁面底只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
      });

      it(`${label}：-deep 若當 glyph 疊自家底 ≥ 3（預防性，warning 目前無 call-site）`, () => {
        const block = paletteBlock(header);
        for (const tone of ['success', 'warning'] as const) {
          const ratio = contrastRatio(tokenValue(block, `color-${tone}-deep`), tokenValue(block, `color-${tone}-bg`));
          expect(ratio, `${label} ${tone}-deep 只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(NON_TEXT);
        }
      });
    }
  });

  describe('destructive 當文字色 —— 已記錄的偏離，仍須 ≥ 4.5', () => {
    // DESIGN.md §語意色的角色分離 把 destructive-as-text 當成「不透明底所以對比可預測」的
    // 對照組（全站十多處都沒有對比問題），沒有要求它一起改中性 —— 紅字錯誤訊息也是很強的
    // 慣例。所以它是**刻意保留的偏離**，不是漏掉的違規；但偏離的正當性完全建立在
    // 「還過 4.5」上，所以這裡把數字鎖住：一旦破線就要改中性字，不是再調深。
    for (const { label, header } of THEMES) {
      it(`${label}：--color-destructive 疊 -destructive-bg`, () => {
        const block = paletteBlock(header);
        const ratio = contrastRatio(tokenValue(block, 'color-destructive'), tokenValue(block, 'color-destructive-bg'));
        expect(ratio, `${label} destructive 文字只有 ${ratio.toFixed(2)}:1 —— 偏離的正當性已消失，改中性字`)
          .toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  });

  describe('prefers-contrast: more 的加強階（HIG 對自訂色的要求）', () => {
    // HIG Color：「If you define a custom color … supply light and dark variants, and an
    // increased contrast option for each variant」。--color-success（#06A77D）與
    // --color-warning（#F48C06）都是自訂色 —— Apple 系統色是 #34C759 / #FF8D28。
    const block = tokens.match(/@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/);
    const parts = () => {
      const pc = block![1];
      const i = pc.indexOf('body.dark');
      return { 淺色: pc.slice(0, i), 深色: pc.slice(i) } as Record<string, string>;
    };

    it('淺深兩邊都宣告了語意色加強階', () => {
      expect(block, '找不到 prefers-contrast: more 區塊').not.toBeNull();
      const p = parts();
      for (const label of ['淺色', '深色']) {
        for (const t of ['--color-success-deep', '--color-warning-deep', '--color-destructive']) {
          // 連冒號一起比對 —— 只比 token 名會讓 `--color-success-deep-XX:` 也算通過
          // （2026-07-26 mutation 抓到過一次同型的無效守衛）。
          expect(p[label], `${label} 加強階缺 ${t}`).toContain(`${t}:`);
        }
      }
    });

    for (const { label, header } of THEMES) {
      it(`${label}：加強階三顆都比一般階更高對比`, () => {
        const part = parts()[label];
        const palette = paletteBlock(header);
        for (const [fgToken, bgToken] of [
          ['color-success-deep', 'color-success-bg'],
          ['color-warning-deep', 'color-warning-bg'],
          ['color-destructive', 'color-destructive-bg'],
        ]) {
          const boosted = part.match(new RegExp(`--${fgToken}:\\s*(#[0-9A-Fa-f]{6})`));
          expect(boosted, `${label} 加強階找不到 --${fgToken} 的值`).not.toBeNull();
          const surface = tokenValue(palette, bgToken);
          expect(contrastRatio(boosted![1], surface), `${label} ${fgToken} 加強階沒有比一般階高`)
            .toBeGreaterThan(contrastRatio(tokenValue(palette, fgToken), surface));
        }
      });
    }
  });

  describe('call-site：語意底上的文字必須是中性色', () => {
    const sources = walk(resolve(root, 'src')).map((f) => ({
      file: f.slice(root.length + 1),
      src: readFileSync(f, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ''),
    }));

    /**
     * `aria-hidden` 的純裝飾 icon 圓底 —— WCAG 1.4.11 把 pure decoration 列為**明文例外**，
     * 沒有門檻拘束（每個旁邊都另有標題文字承載語意）。它們用基色是刻意的：換深階會在淺
     * 圓底上過深、與同頁其他圖示不協調，同 #1156 / #1157 對柔褐裝飾圖示的取捨。
     * 例外成立的前提是它們仍是 aria-hidden —— 下一條測試鎖住這件事。
     */
    const DECORATIVE = [
      '.tp-secret-icon-circle',
      '.tp-success-icon-circle',
      '.tp-result-icon-success',
      '.tp-result-icon-error',
    ];

    it('background: -bg 的規則不得把同族語意色（含 -deep）當文字色', () => {
      const offenders: string[] = [];
      for (const { file, src } of sources) {
        for (const m of src.matchAll(/([^{}\n;]*?)\{([^{}]*)\}/g)) {
          const selector = m[1].trim();
          if (DECORATIVE.includes(selector)) continue;
          const body = m[2].replace(/\s+/g, ' ');
          for (const tone of ['success', 'warning'] as const) {
            if (!new RegExp(`background:\\s*var\\(--color-${tone}-bg\\)`).test(body)) continue;
            // 基色與 -deep 都不行 —— 後者正是 #1176 第一版走錯的那條路
            if (new RegExp(`(^|[;\\s])color:\\s*var\\(--color-${tone}(-deep)?\\)`).test(body)) {
              offenders.push(`${file} ${selector} (${tone})`);
            }
          }
        }
      }
      expect(offenders, '語意底上的文字要用 --color-foreground／--color-muted，顏色訊號交給 aria-hidden glyph').toEqual([]);
    });

    it('裝飾例外的前提仍成立：四個 icon 圓底都還是 aria-hidden', () => {
      // 前提一垮（圖示開始承載語意），1.4.11 就真的適用、門檻 3:1，而它們是基色 ——
      // 淺色實測 2.1–2.6，立刻變違規。unit 白名單會放行、axe 對 aria-hidden 看不到，
      // 兩層都瞎，所以前提本身必須有人鎖。
      const all = sources.map((s) => s.src).join('\n');
      for (const cls of DECORATIVE) {
        expect(all, `${cls} 失去 aria-hidden → 裝飾例外不再成立`)
          .toMatch(new RegExp(`className="[^"]*${cls.slice(1)}[^"]*"\\s+aria-hidden="true"`));
      }
    });
  });
});
