import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DAY_PALETTE, dayColor, dayTextColor } from '../../src/lib/dayPalette';

/**
 * #1168 · Day palette 文字色守衛 —— 飽和 -500 不得直接當文字色。
 *
 * 為什麼需要這一支、而不是靠 tests/e2e/a11y-axe.spec.js：
 *
 * 1. **axe 的單字元盲區。** entry card 的 `num` 內容是 day 序號，行程 ≤9 天時是**單一字元**。
 *    axe 的 color-contrast 規則對「內容恰好 1 個字元」的元素一律歸到 incomplete 而非
 *    violations（axe-core: visibleText.length === 1 → messageKey: shortTextContent），
 *    而該 e2e 只讀 results.violations。也就是說 num 的對比在 e2e 上**永遠掃不到**，
 *    行程滿 10 天變兩位數才會冒出來 —— 綠燈會隨資料量飄。這是 #1156 記錄過的同一個盲區的
 *    第二現場，票（#1168）的坑 2 也明確要求別只修掃得到的那些。
 * 2. **深色模式 e2e 沒在跑。** `--day-text-*` 淺深兩套值，e2e 只驗淺色。
 *
 * 分工：本檔守「call-site 有沒有挑對來源」＋「token 值本身的對比達標」。
 * 元件層 num/eyebrow 各吃哪一顆由 tests/unit/map-entry-card.test.tsx 守。
 */

const TOKENS = readFileSync(resolve(__dirname, '../../css/tokens.css'), 'utf8');

/** WCAG 2.1 相對亮度。 */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 抽出 tokens.css 裡兩組 `--day-text-*`（淺色一組、深色一組）。
 *
 * **刻意不用選擇器定位。** 第一版寫 `TOKENS.indexOf(':root')` 當淺色區塊的錨點，實測抓錯：
 * 這檔是 Tailwind 4，淺色 token 在 `@theme { }` 裡（:84），而第一個 `:root` 在 :248 ——
 * 也就是錨點落在淺色區塊**後面**，往後搜就抓到深色那組（:1066），於是「淺色達標」與
 * 「淺深不同組」兩支測試同時假紅。選擇器名稱是會漂的，不要拿它當結構錨點。
 *
 * 改為：抓全檔所有出現、要求每個 N 恰好兩組，再驗第二組真的落在 `body.dark` 之後。
 * 「恰好兩組」本身就是守衛 —— 多一組（例如有人加了第三個主題卻沒補值）會直接紅。
 */
function extractDayTextGroups(): { light: string[]; dark: string[] } {
  const light: string[] = [];
  const dark: string[] = [];
  for (let n = 1; n <= 10; n += 1) {
    const all = [...TOKENS.matchAll(new RegExp(`--day-text-${n}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))];
    if (all.length !== 2) {
      throw new Error(`tokens.css: --day-text-${n} 出現 ${all.length} 次，預期恰好 2 次（淺色 + 深色各一）`);
    }
    light.push(all[0]![1]!.toUpperCase());
    dark.push(all[1]![1]!.toUpperCase());
    // 驗第二組真的在深色區塊裡：它與前一組之間必須出現過 body.dark。
    const between = TOKENS.slice(all[0]!.index!, all[1]!.index!);
    if (!between.includes('body.dark')) {
      throw new Error(`tokens.css: --day-text-${n} 的第二組不在 body.dark 之後，區塊結構變了`);
    }
  }
  return { light, dark };
}

/**
 * 全檔剝掉 CSS 註解後的版本，供規則層斷言使用。
 *
 * **順序很重要：先剝註解，再抓規則。** 第一版是反過來（先用 `\{([^}]*)\}` 抓規則、再剝
 * 註解），兩個 bug 一起中：
 *   1. 註解裡為了說明歷史而寫出被禁的宣告字樣（eyebrow 的註解就寫了「原本是 opacity: 0.7」）
 *      → 拿自己的說明當違規。
 *   2. 註解裡只要有一個 `}`（該註解寫了「`.is-active … { opacity: 1 }`」），`[^}]*` 就在那裡
 *      提前截斷，擷取到的是未閉合的註解片段 → 連剝註解的正則都失效。
 * 先剝乾淨再抓，兩個問題一次消失。
 */
const TOKENS_NO_COMMENTS = TOKENS.replace(/\/\*[\s\S]*?\*\//g, '');

/** 取某條 CSS 規則的宣告區塊（已無註解）。 */
function ruleBody(selector: string): string {
  const m = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(
    TOKENS_NO_COMMENTS,
  );
  if (!m) throw new Error(`tokens.css: 找不到規則 ${selector}`);
  return m[1]!;
}

describe('#1168 — dayTextColor 回傳 token 引用而非 hex', () => {
  it('回傳 var(--day-text-N)，N 與 dayColor 的輪替一致', () => {
    for (let day = 1; day <= 10; day += 1) {
      expect(dayTextColor(day)).toBe(`var(--day-text-${day})`);
    }
  });

  it('超過 10 天 modulo 輪回，與 dayColor 同步不脫拍', () => {
    for (const day of [11, 12, 20, 21, 35]) {
      const paletteIdx = DAY_PALETTE.indexOf(dayColor(day) as (typeof DAY_PALETTE)[number]);
      expect(dayTextColor(day)).toBe(`var(--day-text-${paletteIdx + 1})`);
    }
  });

  it('無效輸入落回第 1 天（與 dayColor 同一規則）', () => {
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
      expect(dayTextColor(bad)).toBe('var(--day-text-1)');
      expect(dayColor(bad)).toBe(DAY_PALETTE[0]);
    }
  });

  it('**不回傳 hex** —— 回 hex 會鎖死其中一套主題，深色模式必壞', () => {
    for (let day = 1; day <= 12; day += 1) {
      expect(dayTextColor(day)).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
    }
  });
});

describe('#1168 — 前提：飽和 DAY_PALETTE 當文字色確實不達標', () => {
  // 這支是上面整套設計的**理由**。如果哪天色盤換了、原色自己就達標了，
  // 這支會轉紅 —— 那時該回來重新評估還需不需要分兩顆色，而不是默默留著多餘的機制。
  it('10 色疊淺底沒有一個達 4.5（所以才需要 --day-text-*）', () => {
    const LIGHT = '#FFFBF5';
    const passing = DAY_PALETTE.filter((c) => contrast(c, LIGHT) >= 4.5);
    expect(passing, `這些色當淺底文字已達標，分色機制的前提要重評：${passing.join(', ')}`).toEqual([]);
  });
});

describe('#1168 — --day-text-* token 值本身達標（淺／深兩套）', () => {
  // 目標刻意設 5.0 而非門檻 4.5：貼線的值在底色微調時會靜默掉下去。
  const TARGET = 5.0;

  it('淺色：10 顆疊 --color-background(#FFFBF5) 與 print 底(#FFFFFF) 都 ≥5.0', () => {
    const tokens = extractDayTextGroups().light;
    expect(tokens).toHaveLength(10);
    for (const [i, hex] of tokens.entries()) {
      const onPage = contrast(hex, '#FFFBF5');
      const onPrint = contrast(hex, '#FFFFFF');
      expect(onPage, `--day-text-${i + 1} (${hex}) 疊頁面底只有 ${onPage.toFixed(2)}`).toBeGreaterThanOrEqual(TARGET);
      expect(onPrint, `--day-text-${i + 1} (${hex}) 疊列印底只有 ${onPrint.toFixed(2)}`).toBeGreaterThanOrEqual(TARGET);
    }
  });

  it('深色：10 顆疊深色 --color-background(#1C1C1E) 都 ≥5.0', () => {
    const tokens = extractDayTextGroups().dark;
    expect(tokens).toHaveLength(10);
    for (const [i, hex] of tokens.entries()) {
      const v = contrast(hex, '#1C1C1E');
      expect(v, `dark --day-text-${i + 1} (${hex}) 疊深色底只有 ${v.toFixed(2)}`).toBeGreaterThanOrEqual(TARGET);
    }
  });

  it('淺深兩套不可以是同一組值 —— 那代表有一邊沒真的換過', () => {
    const { light, dark } = extractDayTextGroups();
    expect(light).not.toEqual(dark);
  });
});

describe('#1168 — --day-text-* 不得放進 @theme（會被 tree-shake 掉）', () => {
  /**
   * 🔴 v2.57.56 上線後在 **production 產物**實測發現：淺色那組 10 個只有 3 個活著。
   *
   * 機制：Tailwind 4 會掃描原始檔決定 `@theme` 裡哪些變數要保留，掃不到的直接 tree-shake。
   * 而 `dayTextColor()` 是用 `var(--day-text-${n})` **動態組名字**，掃描器看不到。
   * 存活的 1/4/5 恰好是測試檔裡剛好寫死 `var(--day-text-1|4|5)` 字面值的那三個 —— 也就是說
   * 「哪些顏色能上線」取決於測試檔碰巧提到哪幾個，其餘 7 個在 prod 根本不存在。
   * 深色那組全程完整，因為它在 plain `body.dark {}` 裡、不受 @theme 影響。
   *
   * ⚠ **本檔上面那些對比斷言讀的是原始碼，所以它們全綠、而出貨的東西是壞的。**
   * 這一條就是補那個洞：鎖住「宣告位置」，因為位置才是決定它會不會上線的東西。
   */
  it('淺色那組宣告在 plain :root，不在 @theme 區塊內', () => {
    const themeStart = TOKENS.indexOf('@theme');
    expect(themeStart, 'tokens.css 找不到 @theme —— 本守衛的前提變了').toBeGreaterThan(-1);
    // @theme 區塊的結尾：從 @theme 起算第一個「行首單獨的 }」。
    const rel = TOKENS.slice(themeStart).search(/\n\}/);
    expect(rel, '找不到 @theme 的收尾').toBeGreaterThan(-1);
    const themeBlock = TOKENS.slice(themeStart, themeStart + rel);

    const inTheme = [...themeBlock.matchAll(/--day-text-(\d+):/g)].map((m) => m[1]);
    expect(
      inTheme,
      `--day-text-${inTheme.join(',')} 被放回 @theme 了。Tailwind 會把「原始碼裡沒有字面 `
        + `var(--day-text-N)」的那些 tree-shake 掉，而 dayTextColor() 是動態組名字 → `
        + `它們不會出現在 production 的 CSS 裡。放 plain :root。`,
    ).toEqual([]);
  });

  it('凡是名字由 JS 動態組出來的 CSS 變數，都不該進 @theme', () => {
    // 把教訓一般化：src/ 裡任何 `var(--x-${...})` 的前綴都不能在 @theme 裡宣告。
    const dynamicPrefixes = new Set<string>();
    for (const f of ['src/lib/dayPalette.ts']) {
      const src = readFileSync(resolve(__dirname, '../..', f), 'utf8');
      for (const m of src.matchAll(/var\(--([a-z0-9-]+?)-\$\{/g)) dynamicPrefixes.add(m[1]);
    }
    expect(dynamicPrefixes.size, '沒掃到任何動態變數名 —— 守衛條件失效或 dayPalette 改寫了').toBeGreaterThan(0);

    const themeStart = TOKENS.indexOf('@theme');
    const rel = TOKENS.slice(themeStart).search(/\n\}/);
    // ⚠ 必須剝註解再比對：@theme 裡刻意留了一句路標註解提到 --day-text-1..10（告訴後人
    // 不要把它們搬回來），不剝掉就會拿那句說明當違規。第一版正是這樣假紅的。
    const themeBlock = TOKENS.slice(themeStart, themeStart + rel).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const prefix of dynamicPrefixes) {
      expect(
        themeBlock.includes(`--${prefix}-`),
        `--${prefix}-* 的名字是 JS 動態組的，但它宣告在 @theme 裡 → 會被 tree-shake`,
      ).toBe(false);
    }
  });
});

describe('#1168 — day tab eyebrow 不得用 opacity 稀釋對比', () => {
  // 原本 .tp-map-day-tab-eyebrow 是 `opacity: 0.7`，把繼承來的 --color-muted 稀釋到
  // 3.25:1。那不是挑錯 token，是用 opacity 當視覺層級 —— axe 量的是合成後的顏色，
  // 所以任何人再加回 opacity 都會重新破線。DESIGN.md 對 day tab 的措辭是
  // 「idle eyebrow muted、active 實心 accent-fill + accent-foreground」。
  it('.tp-map-day-tab-eyebrow 規則內不含 opacity', () => {
    expect(ruleBody('.tp-map-day-tab-eyebrow')).not.toMatch(/(^|[^-\w])opacity\s*:/);
  });

  it('.is-active 也不得靠 opacity 撐回來（原本那條 opacity: 1 已刪）', () => {
    const m = /\.tp-map-day-tab\.is-active\s+\.tp-map-day-tab-eyebrow\s*\{([^}]*)\}/.exec(
      TOKENS_NO_COMMENTS,
    );
    // 規則整條不存在是預期狀態；若有人加回來，它裡面不能含 opacity。
    if (m) expect(m[1]!).not.toMatch(/(^|[^-\w])opacity\s*:/);
  });

  it('.tp-map-day-tab base 色仍是 --color-muted（eyebrow 靠繼承拿到它）', () => {
    expect(ruleBody('.tp-map-day-tab')).toMatch(/color:\s*var\(--color-muted\)/);
  });
});
