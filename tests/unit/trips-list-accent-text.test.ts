import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * #1156 · 行程一覽頁 call-site 守衛 —— 品牌柔褐不得直接當文字色。
 *
 * 分工：token 之間的對比數值由 tests/unit/tokens-css.test.ts（#1153）守，
 * 那裡已經驗過 accent-text / accent-text-on-tonal 在 light 與 dark 都達 4.5。
 * 這支只守「call-site 有沒有挑對 token」，不重算對比。
 *
 * 為什麼需要這一支、而不是靠 tests/e2e/a11y-axe.spec.js：
 *   axe 的 color-contrast 對「內容恰好 1 個字元」的元素一律降級成 incomplete
 *   （axe-core: visibleText.length === 1 → messageKey: shortTextContent，訊息是
 *   "Element content is too short to determine if it is actual text content"），
 *   而該 e2e 只讀 results.violations。分類 tab 計數徽章在使用者行程數 ≤9 時
 *   就是這種元素：實測 --color-accent(#A97A4A) 疊 --color-accent-subtle(#F4EDE3)
 *   只有 3.24:1，確實違規，但 e2e 看不到。（滿 10 筆變兩位數才掃得出來 ——
 *   也就是這個守衛的可靠度會隨測試帳號的資料量飄，不能當唯一防線。）
 *   只驗 e2e 會得到一個綠著卻沒在守的守衛，正是 #1150 的病。
 */

const pagePath = resolve(__dirname, '../../src/pages/TripsListPage.tsx');

/**
 * 取出 SCOPED_STYLES 樣板字串的內容。
 *
 * 收尾認的是行首的 backtick + 分號，不是「下一個 backtick」——後者會 fail-open：
 * 樣板字串裡只要有人在 CSS 註解寫了一個裸 backtick，就會在那裡靜默截斷，
 * 截斷點之後的違規全部掃不到，而這支測試照樣全綠。那正是本檔要根治的病。
 * 裸 backtick 同時也會終止樣板字串本身、把整個檔案弄壞（見專案 memory
 * scoped-styles-backtick-footgun），所以偵測到就直接 throw，不要吞。
 */
function extractScopedStyles(src: string): string {
  const start = src.indexOf('const SCOPED_STYLES = `');
  if (start < 0) throw new Error('TripsListPage.tsx: 找不到 SCOPED_STYLES 宣告');
  const bodyStart = src.indexOf('`', start) + 1;
  const end = src.indexOf('\n`;', bodyStart);
  if (end < 0) throw new Error('TripsListPage.tsx: 找不到 SCOPED_STYLES 的收尾（行首 `;）');
  const body = src.slice(bodyStart, end);
  if (body.includes('`')) {
    throw new Error('TripsListPage.tsx: SCOPED_STYLES 內含裸 backtick —— 樣板字串會被提前終止');
  }
  return body;
}

/**
 * 攤平出「最內層」的 CSS 規則（selector + body）。
 * `[^{}]*` 跨不過大括號，所以巢狀的 @media 外層會被自動略過，只留裡面的實際規則。
 */
function flatRules(css: string): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));
}

/**
 * 允許繼續用 --color-accent 當 color 的例外：aria-hidden 的純裝飾圖示。
 * 依 WCAG 1.4.11，非文字元件門檻是 3:1 而非 4.5:1，這兩處實測 3.24:1 已達標；
 * 硬換成深色前景 token 會在淺 tonal 圓底上過深、與同頁其他圖示不協調（見票的「已知的坑」）。
 * 兩者旁邊都另有文字標籤，圖示本身不承載資訊。
 */
const DECORATIVE_ICON_RULES = [
  '.tp-trip-card-new .tp-new-icon',
  '.tp-trips-empty-hero .tp-hero-icon',
];

describe('TripsListPage 柔褐文字對比 call-site 守衛（#1156）', () => {
  const src = readFileSync(pagePath, 'utf-8');

  it('SCOPED_STYLES 內 color: var(--color-accent) 只出現在裝飾圖示規則', () => {
    // 要求 color 前面是行首/分號/大括號/空白，才不會誤抓 border-color 或自訂屬性 --t。
    // 尾端用 [;}\s] 界定，避免把 --color-accent-text / -deep / -subtle 也吃進來。
    const bareAccentAsText = /(^|[;{\s])color:\s*var\(--color-accent\)\s*[;}]?/m;
    const offenders = flatRules(extractScopedStyles(src))
      .filter((r) => bareAccentAsText.test(r.body))
      .map((r) => r.selector);

    expect(
      offenders.filter((s) => !DECORATIVE_ICON_RULES.includes(s)),
      '這些規則把品牌柔褐直接當文字色 —— 淺底上對比不足。'
        + '底是頁面色請用 --color-accent-text，底是 tonal 請用 --color-accent-text-on-tonal。',
    ).toEqual([]);
  });

  it('裝飾圖示例外清單沒有腐爛（規則被改名/刪除要炸掉，而不是靜默放行）', () => {
    const selectors = flatRules(extractScopedStyles(src)).map((r) => r.selector);
    for (const rule of DECORATIVE_ICON_RULES) {
      expect(selectors, `例外清單指向不存在的規則：${rule}`).toContain(rule);
    }
  });

  it('樣式抽取有抓到整段（截斷會讓後半的違規靜默漏掃）', () => {
    // .tp-trips-error 是 SCOPED_STYLES 的最後一條規則；抽不到它就代表提前截斷了。
    expect(extractScopedStyles(src)).toContain('.tp-trips-error { color: var(--color-destructive); }');
  });

  it('抽取遇到裸 backtick 會炸而不是靜默截斷（守衛自身的 fail-open 防線）', () => {
    const truncating = 'const SCOPED_STYLES = `\n.a { color: var(--color-accent); } /* ` */\n.b {}\n`;\n';
    expect(() => extractScopedStyles(truncating)).toThrow(/裸 backtick/);
  });

  it('JSX inline style 不得把柔褐當文字色', () => {
    // 例：style={{ color: 'var(--color-accent)' }} —— 「已封存空清單」的重設按鈕曾是這樣。
    const inlineBareAccent = /color:\s*['"]var\(--color-accent\)['"]/g;
    expect([...src.matchAll(inlineBareAccent)].map((m) => m[0])).toEqual([]);
  });
});
