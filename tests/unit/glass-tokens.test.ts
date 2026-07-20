/**
 * Regular Glass 材質包 — token 契約測試
 *
 * 規格 SoT：docs/design-sessions/2026-07-20-chrome-hig-regular-glass.html
 * （已過 CLAUDE.md mockup-first gate，owner 2026-07-20「我要照 HIG 規範」）
 *
 * 背景：全站 chrome 原本用「品牌奶油色 color-mix + blur(14px)」，違反 HIG
 * 「glass 不上 tint，顏色留給 content layer」。本測試鎖住收斂後的單一中性材質。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, extname, relative } from 'path';

const ROOT = resolve(__dirname, '../../');
const tokensPath = resolve(ROOT, 'css/tokens.css');
const tokens = readFileSync(tokensPath, 'utf-8');

/**
 * 從 `needle` 出現處往後做大括號配對，取出該 block 的內容。
 * 用來斷言「token 宣告在哪個 block 裡」——放錯 block 會讓 dark mode 靜默失效，
 * 是本次變更唯一不會被任何既有測試抓到的破法。
 */
function extractBlock(css: string, needle: string | RegExp): string {
  const start = typeof needle === 'string'
    ? css.indexOf(needle)
    : (css.match(needle)?.index ?? -1);
  if (start === -1) throw new Error(`找不到 block 起點：${needle}`);
  const braceStart = css.indexOf('{', start);
  if (braceStart === -1) throw new Error(`${needle} 後找不到 {`);
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return css.slice(braceStart + 1, i);
    }
  }
  throw new Error(`${needle} 的大括號未配對`);
}

// ——— 材質 token 值（逐字對照 mockup） ———
describe('Regular Glass — 六個材質 token', () => {
  it('--glass-tint 為中性白 0.80（不可用品牌 color-mix）', () => {
    // alpha 0.80 由最壞情況對比度反推，非美感值：地圖有 satellite/hybrid 圖磚
    // (MapFabs.tsx MapTileStyle)，膠囊可能浮在近黑或近白影像上。
    // 深色 tint 80% 疊近白衛星 → 合成 #5E5E5E，配 --color-foreground = 5.92:1 ✅
    // 若用 0.62 只有 3.55:1 ❌（11px bold 不算 WCAG large text，門檻 4.5 非 3.0）
    expect(tokens).toMatch(/--glass-tint:\s*rgba\(255,\s*255,\s*255,\s*0?\.80\)/);
  });

  it('--glass-filter 含 blur(24px) 與 saturate(180%)', () => {
    // saturate 是 HIG「content 的光溢出到玻璃表面」的廉價替代，不可省 —— 少了它玻璃會死灰
    expect(tokens).toMatch(/--glass-filter:\s*blur\(24px\)\s+saturate\(180%\)/);
  });

  it('--glass-rim 為 border shorthand', () => {
    expect(tokens).toMatch(/--glass-rim:\s*1px solid rgba\(255,\s*255,\s*255,\s*0?\.50\)/);
  });

  it('--glass-specular 為 inset box-shadow', () => {
    expect(tokens).toMatch(/--glass-specular:\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0?\.62\)/);
  });

  it('--glass-shadow 為雙層落影', () => {
    expect(tokens).toMatch(/--glass-shadow:\s*0 10px 30px rgba\(42,\s*31,\s*24,\s*0?\.18\),\s*0 2px 6px rgba\(42,\s*31,\s*24,\s*0?\.10\)/);
  });

  it('--chrome-inset 為 21px（HIG iOS 26 膠囊 inset）', () => {
    expect(tokens).toMatch(/--chrome-inset:\s*21px/);
  });
});

// ——— Token 放置位置（dark mode 靜默失效的唯一防線） ———
describe('Regular Glass — token 放置位置', () => {
  // 隨主題變值的 token 放錯位置會讓深色靜默失效，而且視覺上「淺色沒壞、深色壞掉」
  // 在 review 極易漏看 —— 這是本次變更唯一不會被任何既有測試抓到的破法。
  //
  // 正解＝照既有已驗證的模式：淺色放 @theme，深色放 @layer base { body.dark }。
  // 這組合之所以有效，實測是因為 **Tailwind 4 建置時把 @layer 攤平**
  // （dist/assets/*.css 內沒有任何 @layer），最終由特異性 + 原始碼順序決定：
  // body.dark(0,1,1) 勝過 @theme 編譯出的 :root(0,1,0)。
  //
  // ⚠ 不要反過來推論「所以放哪都行」。順序仍然要命 —— 見下方
  //   「a11y fallback 位置與深色分支」describe，那裡記錄了一個真的踩到的 bug。
  // ⚠ 也不要把 token 塞進未分層的 body{}：那是 (0,0,1)，比 body.dark 弱，深色會吃不到。
  const themeBlock = extractBlock(tokens, '@theme');
  const darkBlock = extractBlock(tokens, /body\.dark\s*\{\s*--color-accent:/);
  const unlayeredBody = extractBlock(tokens, 'Composite tokens on body');

  const themeVarying = ['--glass-tint', '--glass-rim', '--glass-specular', '--glass-shadow'];

  it.each(themeVarying)('%s 的淺色值宣告在 @theme block 內', (token) => {
    expect(themeBlock).toContain(`${token}:`);
  });

  it.each(themeVarying)('%s 在 body.dark 有深色覆寫', (token) => {
    expect(darkBlock).toContain(`${token}:`);
  });

  it.each(themeVarying)('%s 不得放在未分層的 body{} —— 會壓過 body.dark 使深色失效', (token) => {
    expect(unlayeredBody).not.toContain(`${token}:`);
  });

  it('--glass-filter / --chrome-inset 不隨主題變值，留在 @theme 即可', () => {
    expect(themeBlock).toContain('--glass-filter:');
    expect(themeBlock).toContain('--chrome-inset:');
  });
});

// ——— Dark 覆寫值 ———
describe('Regular Glass — dark 覆寫值', () => {
  const darkBlock = extractBlock(tokens, /body\.dark\s*\{\s*--color-accent:/);

  it('dark --glass-tint 為中性深灰 rgba(44,44,46,.80)（不是深棕）', () => {
    expect(darkBlock).toMatch(/--glass-tint:\s*rgba\(44,\s*44,\s*46,\s*0?\.80\)/);
  });

  it('dark --glass-rim 降到 0.14', () => {
    expect(darkBlock).toMatch(/--glass-rim:\s*1px solid rgba\(255,\s*255,\s*255,\s*0?\.14\)/);
  });

  it('dark --glass-specular 降到 0.16', () => {
    expect(darkBlock).toMatch(/--glass-specular:\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0?\.16\)/);
  });

  it('dark --glass-shadow 用純黑而非暖褐', () => {
    expect(darkBlock).toMatch(/--glass-shadow:\s*0 10px 30px rgba\(0,\s*0,\s*0,\s*0?\.55\),\s*0 2px 6px rgba\(0,\s*0,\s*0,\s*0?\.4\)/);
  });
});

// ——— A11y fallback（HIG 系統自動，Web 必須手寫） ———
describe('Regular Glass — a11y fallback', () => {
  it('有 prefers-reduced-transparency 降級（玻璃霜化）', () => {
    expect(tokens).toMatch(/@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
  });

  it('reduced-transparency 把 tint 提到 0.94 且 blur 降到 8px', () => {
    const block = extractBlock(tokens, '@media (prefers-reduced-transparency: reduce)');
    expect(block).toMatch(/--glass-tint:\s*rgba\(255,\s*255,\s*255,\s*0?\.94\)/);
    expect(block).toMatch(/--glass-filter:\s*blur\(8px\)/);
  });

  it('有 prefers-contrast: more 降級（近黑白 + 對比邊框）', () => {
    expect(tokens).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
  });

  it('prefers-contrast 關掉 blur 並改用不透明底 + 2px 對比邊框', () => {
    const block = extractBlock(tokens, '@media (prefers-contrast: more)');
    expect(block).toMatch(/--glass-tint:\s*var\(--color-background\)/);
    expect(block).toMatch(/--glass-filter:\s*none/);
    expect(block).toMatch(/--glass-rim:\s*2px solid var\(--color-foreground\)/);
  });

  it('backdrop-filter 不支援時給不透明地板（80% tint 無 blur 在地圖上不可讀）', () => {
    expect(tokens).toMatch(/@supports\s+not\s*\(backdrop-filter:/);
  });
});

// ——— a11y fallback 位置（本次 review 抓到的實際 bug）———
describe('Regular Glass — a11y fallback 位置與深色分支', () => {
  // Tailwind 4 建置產物會把 @layer 攤平（dist CSS 內無任何 @layer），所以這些覆寫
  // 不能靠串接層規則生效，只能靠**特異性 + 原始碼順序**。
  // 要蓋掉的目標是 body.dark（0,1,1）的正常材質值；同特異性下後出現者勝
  // → fallback 必須排在 body.dark 之後。
  //
  // 初版把它們放在檔案前段，實測後果：
  //   ① 深色 + Reduce Transparency → 正常 dark tint 勝出，霜化完全不生效
  //   ② 深色 + Increase Contrast → 只寫 body(0,0,1)，永遠輸給 body.dark(0,1,1)
  // 兩者都只在深色壞、淺色完全正常，是最容易在 review 漏看的形狀。

  const darkPaletteIdx = tokens.indexOf('--color-background: #1C1C1E');

  const FALLBACKS: [string, string][] = [
    ['reduced-transparency', '@media (prefers-reduced-transparency: reduce)'],
    ['contrast', '@media (prefers-contrast: more)'],
    ['no-backdrop-filter', '@supports not (backdrop-filter:'],
  ];

  it.each(FALLBACKS)('%s block 排在 body.dark 調色盤之後', (_label, needle) => {
    const idx = tokens.indexOf(needle);
    expect(idx, `找不到 ${needle}`).toBeGreaterThan(-1);
    expect(darkPaletteIdx, '找不到 body.dark 調色盤').toBeGreaterThan(-1);
    expect(idx).toBeGreaterThan(darkPaletteIdx);
  });

  it.each(FALLBACKS)('%s block 內含 body.dark 分支（少了它深色吃不到覆寫）', (_label, needle) => {
    const block = extractBlock(tokens, needle);
    expect(block).toMatch(/body\.dark/);
  });

  it('reduced-transparency 的深色分支同時降 tint 與 blur', () => {
    const block = extractBlock(tokens, '@media (prefers-reduced-transparency: reduce)');
    // 只降 tint 不降 blur → 深色下仍是 24px 重模糊，霜化感與淺色不一致
    expect(block).toMatch(/--glass-tint:\s*rgba\(44,\s*44,\s*46,\s*0?\.96\)/);
    expect((block.match(/--glass-filter:\s*blur\(8px\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

// ——— 退役 token ———
describe('退役 token 全域清除', () => {
  function collectFiles(dir: string, exts: Set<string>): string[] {
    const results: string[] = [];
    try {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        if (statSync(full).isDirectory()) results.push(...collectFiles(full, exts));
        else if (exts.has(extname(entry))) results.push(full);
      }
    } catch { /* skip inaccessible dirs */ }
    return results;
  }

  const SCAN_EXTS = new Set(['.css', '.ts', '.tsx']);
  const files = [
    ...collectFiles(resolve(ROOT, 'css'), SCAN_EXTS),
    ...collectFiles(resolve(ROOT, 'src'), SCAN_EXTS),
  ];

  const RETIRED = ['--blur-glass', '--color-glass-nav', '--color-glass-toast'];

  it.each(RETIRED)('css/ + src/ 不再引用 %s', (retired) => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes(retired)) violations.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    if (violations.length > 0) {
      throw new Error(`${retired} 已退役，仍有引用：\n${violations.join('\n')}`);
    }
    expect(violations).toHaveLength(0);
  });

  it('chrome 不再用品牌色 color-mix 當玻璃底（HIG：glass 不上 tint）', () => {
    // 只查 chrome 選擇器；sidebar vibrancy 與 small-button 是 DESIGN.md 核可例外，不在此列。
    const CHROME_SELECTORS = [
      '.tp-global-bottom-nav',
      '.tp-titlebar',
      '.tp-page-bottom-bar',
      '.tp-map-day-tabs',
      '.tp-bottom-nav',
    ];
    const violations: string[] = [];
    for (const selector of CHROME_SELECTORS) {
      let body: string;
      try { body = extractBlock(tokens, `${selector} {`); } catch { continue; }
      if (/background:\s*color-mix\([^)]*--color-(background|secondary|accent)/.test(body)) {
        violations.push(`${selector} 仍用品牌色 color-mix 當玻璃底`);
      }
    }
    expect(violations).toEqual([]);
  });
});
