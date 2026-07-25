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
  // ${...} 內插進來的片段這支測試看不到，會被解析成假的 rule 並污染前後邊界。
  // 與裸 backtick 同級對待：寧可炸掉要求改寫，也不要靜默漏掃一整段。
  if (body.includes('${')) {
    throw new Error('TripsListPage.tsx: SCOPED_STYLES 含 ${} 內插 —— 被內插的 CSS 掃不到，請改成直接寫入或另立守衛');
  }
  return body;
}

/**
 * 攤平出「最內層」的 CSS 規則（selector + body）。
 * `[^{}]*` 跨不過大括號，所以巢狀的 @media 外層會被自動略過，只留裡面的實際規則。
 *
 * 進 regex 前先剝掉 CSS 註解：selector 的 capture 是「上一個 } 到下一個 { 之間的全部文字」，
 * 不剝的話規則上方的註解會被併進 selector 字串。這份 SCOPED_STYLES 幾乎每條規則上方都有
 * 註解，一旦有人在裝飾圖示規則上方加一行說明，例外清單的精確比對就會失效 —— 而錯誤訊息
 * 會是「這些規則把品牌柔褐直接當文字色」，把人導向改錯地方。
 */
function flatRules(css: string): Array<{ selector: string; body: string }> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rules = [...noComments.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));
  // 原生 CSS 巢狀會讓外層宣告從掃描裡蒸發，而且沒有任何訊號。fail-closed。
  //
  // ⚠ 兩道判準必須**並存**，它們互補而不是互相取代（實測）：
  //   A「宣告落進 selector」擋得住無 `&` 的巢狀（bare class、巢狀 @media —— CSS Nesting
  //     relaxed 語法不需要 `&`），但擋不住「宣告寫在巢狀區塊之後」的排列（那時 selector
  //     只剩 `&:hover`，不含宣告）。
  //   B「出現 `&`」剛好相反：位置無關，但無 `&` 的巢狀完全看不到。
  // 只留其中一個都會留下一整類 fail-open。
  //
  // B 要在剝掉字串與 url() 之後才測 —— 否則 `content: "Q & A"` 這種合法寫法會被誤判成巢狀，
  // 而錯誤訊息叫人「改回扁平規則」完全是錯的指引。
  const declInSelector = rules.filter((r) => /(^|[;\s])[a-z-]+\s*:\s*[^;{]+;/.test(r.selector));
  if (declInSelector.length) {
    throw new Error(
      `SCOPED_STYLES 疑似使用原生 CSS 巢狀（宣告落進 selector）：${declInSelector[0].selector.slice(0, 60)}…\n`
      + '攤平邏輯處理不了巢狀，外層宣告會被靜默漏掃。請改回扁平規則，或換成真正的 CSS parser。',
    );
  }
  const withoutStrings = noComments
    .replace(/"[^"]*"|'[^']*'/g, '""')
    .replace(/url\([^)]*\)/g, 'url()');
  if (/(^|[\s,({;])&/.test(withoutStrings)) {
    throw new Error(
      'SCOPED_STYLES 疑似使用原生 CSS 巢狀（出現 &）。\n'
      + '攤平邏輯處理不了巢狀，外層宣告會被靜默漏掃。請改回扁平規則，或換成真正的 CSS parser。',
    );
  }
  return rules;
}

/**
 * 「把柔褐當文字色」的偵測式。
 *
 * - 前綴 `(^|[;{\s])` 要求 color 前面是行首/分號/大括號/空白，才不會誤抓 `border-color`。
 * - 結尾 `\s*[,)]` 同時涵蓋 `var(--color-accent)` 與帶 fallback 的 `var(--color-accent, #A97A4A)`，
 *   也讓 `--color-accent-text` / `-deep` / `-subtle` 不被誤匹配（它們後面接的是 `-`）。
 * - `--color-accent-2` / `-3` 在 tokens.css 裡是**同一個 hex**（light `#A97A4A`、dark `#CBA06E`），
 *   三色系統退場後值被統一但 token 名保留給既有消費者。不一起擋等於前門上鎖後門開著。
 * - 硬編碼 hex 同理。
 */
const ACCENT_AS_TEXT = /(^|[;{\s])color:\s*(var\(\s*--color-accent(-[23])?\s*[,)]|#a97a4a\b)/im;

/**
 * `--t` 是同檔 `.tp-trip-card[data-tone]` 定義的 tone 別名，值就是 `var(--color-accent)`。
 *
 * ⚠ 不含 `--t-deep`：它是 `var(--color-accent-deep)` = `#8A6038`，與 `--color-accent-text`
 *   同值，拿來當文字色是**合規的**。同檔的 `.tp-trip-card-avatar` 就直接用 `--color-accent-deep`。
 */
const ACCENT_ALIAS_AS_TEXT = /(^|[;{\s])color:\s*var\(\s*--t\s*[,)]/m;

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
    const offenders = flatRules(extractScopedStyles(src))
      .filter((r) => ACCENT_AS_TEXT.test(r.body))
      .map((r) => r.selector);

    expect(
      offenders.filter((s) => !DECORATIVE_ICON_RULES.includes(s)),
      '這些規則把品牌柔褐直接當文字色 —— 淺底上對比不足。'
        + '底是頁面色請用 --color-accent-text，底是 tonal 請用 --color-accent-text-on-tonal。',
    ).toEqual([]);
  });

  it('tone 別名 --t 不得當文字色（它的值就是 --color-accent）', () => {
    const offenders = flatRules(extractScopedStyles(src))
      .filter((r) => ACCENT_ALIAS_AS_TEXT.test(r.body))
      .map((r) => r.selector);

    expect(
      offenders,
      '這些規則透過 --t 別名間接把柔褐當文字色 —— 繞過主偵測式但對比一樣不足。',
    ).toEqual([]);
  });

  it('裝飾圖示例外清單沒有腐爛（規則被改名/刪除要炸掉，而不是靜默放行）', () => {
    // 只驗 selector 字串存在是空洞的：`.tp-trip-card-new .tp-new-icon` 在 @media 內另有一條
    // 同名的尺寸覆寫規則，就算 base 規則被改名，toContain 也永遠為真。
    // 要驗的是「例外指向的那條規則，確實還帶著 color: var(--color-accent)」。
    const rules = flatRules(extractScopedStyles(src));
    for (const rule of DECORATIVE_ICON_RULES) {
      const carrying = rules.filter((r) => r.selector === rule && ACCENT_AS_TEXT.test(r.body));
      expect(
        carrying.length,
        `例外 ${rule} 實際帶 --color-accent 的規則有 ${carrying.length} 條，預期 1 條`
        + '（0 = 規則被改名/刪除，或這條例外已是死條目該清掉；>1 = @media 覆寫也帶了色，需一併檢視）',
      ).toBe(1);
    }
  });

  it('--t-deep 放行的前提仍成立（它必須指向 --color-accent-deep）', () => {
    // ACCENT_ALIAS_AS_TEXT 刻意不擋 --t-deep，理由是它 = --color-accent-deep = accent-text 同值。
    // 那個前提就寫在被掃描的同一個檔案裡，一次 token 收斂改掉它，--t-deep 就會同時繞過
    // 兩條偵測式。前提本身要有人鎖 —— 同 aria-hidden 那條的道理。
    // 別名不存在 = 豁免也用不到 = 通過。`--t-deep` 目前 0 個消費者，把它清掉是合理的
    // 整理，測試不該要求死 code 留在原地（只是清的時候記得連 ACCENT_ALIAS_AS_TEXT 的
    // 豁免說明一起移除）。
    const scoped = extractScopedStyles(src);
    const defs = [...scoped.matchAll(/--t-deep:\s*var\(([^)]+)\)/g)].map((m) => m[1].trim());
    if (defs.length) {
      expect([...new Set(defs)], '--t-deep 不再指向 --color-accent-deep —— 放行它的前提垮了')
        .toEqual(['--color-accent-deep']);
    }
  });

  it('裝飾例外的前提仍成立：兩個圖示都還是 aria-hidden', () => {
    // 這兩處留 --color-accent 的「全部」正當性，就是它們是 aria-hidden 的純裝飾
    // （WCAG 1.4.11 門檻 3:1 而非 4.5:1，實測 3.24 剛好達標）。前提一垮，3.24 立刻變違規，
    // 但 unit 守衛會因為它們在例外清單裡而放行、e2e 會因為 aria-hidden/單字元而看不到。
    // 兩層都瞎，所以前提本身必須有人鎖。
    expect(src, '.tp-new-icon 失去 aria-hidden → 3:1 例外不再成立')
      .toMatch(/className="tp-new-icon"\s+aria-hidden="true"/);
    expect(src, '.tp-hero-icon 失去 aria-hidden → 3:1 例外不再成立')
      .toMatch(/className="tp-hero-icon"\s+aria-hidden="true"/);
  });

  it('規則上方的 CSS 註解不會混進 selector（否則例外清單會誤爆）', () => {
    const css = '/* 說明註解 */\n.tp-trip-card-new .tp-new-icon { color: var(--color-accent); }';
    expect(flatRules(css).map((r) => r.selector)).toEqual(['.tp-trip-card-new .tp-new-icon']);
  });

  it('偵測式涵蓋同值別名與 fallback 語法、且不誤抓深色變體', () => {
    // 該抓的
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent);')).toBe(true);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent, #A97A4A);')).toBe(true);
    expect(ACCENT_AS_TEXT.test('  color: var( --color-accent );')).toBe(true);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent-2);')).toBe(true);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent-3);')).toBe(true);
    expect(ACCENT_AS_TEXT.test('  color: #A97A4A;')).toBe(true);
    expect(ACCENT_ALIAS_AS_TEXT.test('  color: var(--t);')).toBe(true);
    // 不該抓的：非文字屬性、以及與 --color-accent-text 同值的深色變體
    expect(ACCENT_AS_TEXT.test('  border-color: var(--color-accent);')).toBe(false);
    expect(ACCENT_AS_TEXT.test('  background: var(--color-accent);')).toBe(false);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent-text);')).toBe(false);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent-text-on-tonal);')).toBe(false);
    expect(ACCENT_AS_TEXT.test('  color: var(--color-accent-deep);')).toBe(false);
    expect(ACCENT_ALIAS_AS_TEXT.test('  color: var(--t-deep);')).toBe(false);
    expect(ACCENT_ALIAS_AS_TEXT.test('  background: var(--t);')).toBe(false);
  });

  it('原生 CSS 巢狀會炸而不是靜默漏掃外層宣告（四種排列都要擋）', () => {
    // 兩道判準互補，缺一就漏一整類 —— 這四種都必須 throw。
    expect(() => flatRules('.tp-x {\n  color: var(--color-accent);\n  &:hover { color: red; }\n}'),
      '& 巢狀、宣告在前').toThrow(/巢狀/);
    expect(() => flatRules('.tp-x {\n  &:hover { color: red; }\n  color: var(--color-accent);\n}'),
      '& 巢狀、宣告在後').toThrow(/巢狀/);
    expect(() => flatRules('.tp-x {\n  color: var(--color-accent);\n  .child { color: red; }\n}'),
      'bare class 巢狀（無 &）').toThrow(/巢狀/);
    expect(() => flatRules('.tp-x {\n  color: var(--color-accent);\n  @media (max-width: 760px) { font-size: 10px; }\n}'),
      '巢狀 @media（無 &）').toThrow(/巢狀/);
  });

  it('合法的扁平 CSS 不會被巢狀守衛誤爆', () => {
    expect(() => flatRules('.tp-y::after { content: "Q & A"; }')).not.toThrow();
    expect(() => flatRules('.tp-y { font-family: "A & B"; }')).not.toThrow();
    expect(() => flatRules('.tp-y { background-image: url("data:image/svg+xml;utf8,<svg><text>A &amp; B</text></svg>"); }')).not.toThrow();
    expect(() => flatRules('@media (max-width: 760px) {\n  .tp-z { color: red; }\n}')).not.toThrow();
  });

  it('${} 內插會炸而不是靜默漏掃被內插的 CSS', () => {
    const interpolated = 'const SCOPED_STYLES = `\n.a { color: red; }\n${SHARED}\n`;\n';
    expect(() => extractScopedStyles(interpolated)).toThrow(/內插/);
  });

  it('樣式抽取有抓到整段（截斷會讓後半的違規靜默漏掃）', () => {
    // 這條的錨點只能涉及守衛自己的領域。試過兩種都不行：
    //   逐字比對整行 → formatter 一動就假紅；
    //   「最後一條規則必須是 X」→ 在尾端加規則就假紅；
    //   拿 `interface TripInfo` 當 marker → 改名／搬位置／中間多一個樣板字串都假紅，
    //     而三種訊息都寫「疑似提前截斷」，把人導去查 CSS 尾端。
    // 真正自足的不變式是「抽取區間裡的 backtick 恰好一對」—— 提前截斷必然是因為中間
    // 冒出第三個 backtick（而那也會被 extractScopedStyles 直接 throw）。
    const start = src.indexOf('const SCOPED_STYLES = `');
    const bodyStart = src.indexOf('`', start) + 1;
    const end = src.indexOf('\n`;', bodyStart);
    expect((src.slice(start, end + 3).match(/`/g) ?? []).length,
      '抽取區間內的 backtick 不是恰好一對 —— 疑似提前截斷').toBe(2);

    // 尾端那條規則仍在掃描範圍內（截斷在它之前就會漏掉）。
    const selectors = flatRules(extractScopedStyles(src)).map((r) => r.selector);
    expect(selectors).toContain('.tp-trips-error');
  });

  it('抽取遇到裸 backtick 會炸而不是靜默截斷（守衛自身的 fail-open 防線）', () => {
    const truncating = 'const SCOPED_STYLES = `\n.a { color: var(--color-accent); } /* ` */\n.b {}\n`;\n';
    expect(() => extractScopedStyles(truncating)).toThrow(/裸 backtick/);
  });

  it('JSX inline style 不得把柔褐當文字色', () => {
    // 例：style={{ color: 'var(--color-accent)' }} —— 「已封存空清單」的重設按鈕曾是這樣。
    // 引號類別含反引號：JSX inline style 也可以寫成樣板字串。
    // 同時擋同值的 --color-accent-2 / -3 與硬編碼 hex，理由同 ACCENT_AS_TEXT。
    // ⚠ 開頭的 \b 不可省：這條為了比對硬編碼 hex 而帶 i flag，沒有邊界的話
    //   `borderColor:` / `backgroundColor:` / `outlineColor:` 的 camelCase 字尾也會命中 ——
    //   而那兩種用途是 DESIGN.md 明文允許的（邊框走 3:1、CTA 填色維持柔褐）。
    const inlineBareAccent = /\bcolor:\s*['"`](var\(\s*--color-accent(-[23])?\s*[,)][^'"`]*|#a97a4a)['"`]/gi;
    expect([...src.matchAll(inlineBareAccent)].map((m) => m[0])).toEqual([]);

    // 鎖住上面那道邊界，別再走丟。
    const probe = (s: string) => { inlineBareAccent.lastIndex = 0; return inlineBareAccent.test(s); };
    expect(probe("color: 'var(--color-accent)'")).toBe(true);
    expect(probe("color: '#A97A4A'")).toBe(true);
    expect(probe("borderColor: 'var(--color-accent)'")).toBe(false);
    expect(probe("backgroundColor: '#A97A4A'")).toBe(false);
    expect(probe("outlineColor: 'var(--color-accent)'")).toBe(false);
  });
});
