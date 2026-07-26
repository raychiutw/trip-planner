import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * DESIGN.md §Focus Indicator（2026-07-26 依 HIG 拍板）的守衛。
 *
 * 規則來源是 HIG Accessibility：「Rely on system-provided focus effects. … Consider
 * creating custom focus effects only if it's absolutely necessary.」—— `outline` 就是那個
 * system-provided 機制，`outline: none` + 自畫 `box-shadow` 是被勸阻的那一邊。
 *
 * 這一組守的是「機制」與「顏色角色」，不是幾何數值 —— HIG 對 thickness / offset / 色值
 * 完全沉默，2px / 2px 是本專案自訂的（見 DESIGN.md 規則表的「依據」欄）。
 */

const root = resolve(__dirname, '../..');
const tokensPath = resolve(root, 'css/tokens.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * 先剝註解再掃規則。順序是關鍵 —— 註解裡的 `}` 會把 `\{([^}]*)\}` 提早截斷，
 * 而本檔的說明註解本身就寫著 `outline: none` 這類反例字樣，不剝就會拿自己的
 * 註解當違規（本 repo 2026-07 已經踩過三次）。
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

interface Rule {
  file: string;
  line: number;
  selector: string;
  body: string;
}

/** 抽出所有 `selector { ... }`。本 repo 的 CSS（含 SCOPED_STYLES 樣板字串）都是扁平無巢狀的。 */
function focusRules(): Rule[] {
  const out: Rule[] = [];
  for (const file of [...walk(resolve(root, 'css')), ...walk(resolve(root, 'src'))]) {
    const raw = readFileSync(file, 'utf-8');
    const src = stripComments(raw);
    for (const m of src.matchAll(/([^{}\n;]*?)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      // 只認真正的 CSS focus selector。用 `includes('focus')` 會把 JS 區塊一起撈進來
      // （`if (… focusId !== undefined) {`、`focusId={…}`、`const focusedIdx = useMemo(() => {`），
      // 那些的「宣告」永遠通不過語法檢查、會製造整批假違規。
      if (!/:focus|\.is-focused/.test(selector)) continue;
      out.push({
        file: file.slice(root.length + 1),
        line: src.slice(0, m.index).split('\n').length,
        selector,
        body: m[2],
      });
    }
  }
  return out;
}

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

function tokenValue(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`找不到 --${name}`);
  return m[1];
}

/**
 * 取含 `--color-accent:` 的那個宣告區塊。
 * ⚠ 淺色色票在 `@theme {}` 不在 `:root {}` —— 傳錯 header 會讓這裡 throw，
 * 那是「假紅」（測試紅了但不是因為受測條件不滿足），修的時候容易誤判成已經有守到。
 * 也要避開 composite override（另一個 body.dark 區塊）與 body.theme-print 的第三份色票。
 */
function paletteBlock(css: string, header: string): string {
  const blocks = [...css.matchAll(new RegExp(`${header}\\s*\\{([\\s\\S]*?)\\}`, 'g'))].map((m) => m[1]);
  const found = blocks.find((b) => b.includes('--color-accent:'));
  if (!found) throw new Error(`tokens.css: 找不到含 --color-accent 的 ${header} 區塊`);
  return found;
}

const NON_TEXT_MIN = 3.0; // WCAG 1.4.11 Non-text Contrast（AA）

describe('DESIGN.md §Focus Indicator — 機制與顏色角色守衛（#1182）', () => {
  const tokensRaw = readFileSync(tokensPath, 'utf-8');
  const tokens = stripComments(tokensRaw);

  describe('顏色角色分離', () => {
    it('--color-focus-ring 在淺色與深色都有宣告', () => {
      // HIG Color 的 macOS 動態系統色表把 `Keyboard focus indicator color` 與
      // `Control accent` 列為兩個分開的條目 —— 壓成同一顆 token 是矛盾的根。
      expect(paletteBlock(tokens, '@theme'), '淺色缺 --color-focus-ring')
        .toMatch(/--color-focus-ring:\s*#[0-9A-Fa-f]{6}/);
      expect(paletteBlock(tokens, 'body\\.dark'), '深色缺 --color-focus-ring')
        .toMatch(/--color-focus-ring:\s*#[0-9A-Fa-f]{6}/);
    });

    it('焦點色對頁面底色 ≥ 3:1（WCAG 1.4.11，淺深都要）', () => {
      // outline-offset 的間隙露出的是父層底色，所以驗頁面底色即可涵蓋絕大多數 call-site。
      for (const header of ['@theme', 'body\\.dark']) {
        const block = paletteBlock(tokens, header);
        const ratio = contrastRatio(tokenValue(block, 'color-focus-ring'), tokenValue(block, 'color-background'));
        expect(ratio, `${header} 焦點色對底色只有 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
      }
    });

    it('--shadow-ring token 已刪除（慣例 A 沒有殘留的入口）', () => {
      // 留著 token 就會有人繼續 call。遷移完成後它必須消失，否則「凍結」只是宣告。
      expect(tokens, '--shadow-ring 還在，慣例 A 仍有入口').not.toMatch(/--shadow-ring\s*:/);
    });

    it('prefers-contrast: more 有提供焦點色的加強階', () => {
      // HIG Color：「supply light and dark variants, and an increased contrast option for each variant」
      const m = tokens.match(/@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/);
      expect(m, '找不到 prefers-contrast: more 區塊').not.toBeNull();
      // ⚠ 不能用 toContain('--color-focus-ring') —— 那連 `--color-focus-ring-XX:` 都算通過
      //   （2026-07-26 mutation 實測：改名後這條仍然綠，等於沒守）。要連冒號一起比對，
      //   而且淺色與深色兩階各驗一次，少一階就紅。
      const pc = m![1];
      const decls = [...pc.matchAll(/--color-focus-ring:\s*(#[0-9A-Fa-f]{6})/g)].map((x) => x[1]);
      expect(decls.length, 'prefers-contrast 需要淺色與深色各一階加強焦點色').toBe(2);
      const [light, dark] = decls;
      const lightBase = tokenValue(paletteBlock(tokens, '@theme'), 'color-focus-ring');
      const darkBase = tokenValue(paletteBlock(tokens, 'body\\.dark'), 'color-focus-ring');
      const bgLight = tokenValue(paletteBlock(tokens, '@theme'), 'color-background');
      const bgDark = tokenValue(paletteBlock(tokens, 'body\\.dark'), 'color-background');
      expect(contrastRatio(light, bgLight), '淺色加強階沒有比一般階更高對比')
        .toBeGreaterThan(contrastRatio(lightBase, bgLight));
      expect(contrastRatio(dark, bgDark), '深色加強階沒有比一般階更高對比')
        .toBeGreaterThan(contrastRatio(darkBase, bgDark));
    });
  });

  describe('機制收斂', () => {
    const rules = focusRules();

    it('盤點到的 focus 規則數量合理（守衛本身沒有掃空）', () => {
      // 這條是 meta guard：上面的 regex 若因檔案結構改變而掃不到東西，
      // 下面幾條「數量為 0」的斷言會全部假綠。
      expect(rules.length, 'focus 規則掃到的數量異常，正則可能失效').toBeGreaterThan(40);
    });

    it('沒有任何 focus 規則使用 --shadow-ring（慣例 A 已退場）', () => {
      const offenders = rules
        .filter((r) => r.body.includes('--shadow-ring'))
        .map((r) => `${r.file}:${r.line} ${r.selector}`);
      expect(offenders, 'outline:none + 自畫 box-shadow 是 HIG 勸阻的寫法，改用 outline + outline-offset').toEqual([]);
    });

    it('沒有任何 focus 規則用負的 outline-offset', () => {
      // 負值把框畫進元件自己的 padding box，相鄰色又變回自家底色 ——
      // 跟被否決的慣例 A 是同一個失效模式。
      const offenders = rules
        .filter((r) => /outline-offset:\s*-/.test(r.body))
        .map((r) => `${r.file}:${r.line} ${r.selector}`);
      expect(offenders, '負 outline-offset 讓間隙露不出父層底色').toEqual([]);
    });

    it('每個 focus 規則的宣告都是合法的 `prop: value;`（缺分號會靜默壞掉）', () => {
      // 這條的存在理由：2026-07-26 批次遷移時腳本漏了分號，產出
      // `outline: 2px solid var(...)\n  outline-offset: 2px` 這種黏在一起的宣告。
      // 上面那幾條「有沒有出現某字串」的斷言在那個狀態下**全綠** —— 子字串都還在，
      // 但整條規則被瀏覽器丟棄、焦點框完全消失。守衛比對字串就要一起驗語法。
      const offenders: string[] = [];
      for (const r of rules) {
        if (r.selector.includes('$')) continue; // 樣板字串內插，不是 CSS 規則
        for (const decl of r.body.split(';').map((d) => d.trim()).filter(Boolean)) {
          // 合法宣告只有一個「屬性:」開頭；`)` 後面又冒出 `prop:` 代表少了分號
          if (!decl.includes(':') || /\)\s+[a-z-]+\s*:/.test(decl)) {
            offenders.push(`${r.file}:${r.line} ${r.selector} → ${decl.slice(0, 70)}`);
            break;
          }
        }
      }
      expect(offenders, 'focus 規則裡有語法不合法的宣告').toEqual([]);
    });

    it('畫 outline 的 focus 規則一律用 --color-focus-ring', () => {
      const offenders = rules
        .filter((r) => /outline:\s*[0-9]/.test(r.body) && !r.body.includes('--color-focus-ring'))
        .map((r) => `${r.file}:${r.line} ${r.selector}`);
      expect(offenders, '焦點框顏色要走 --color-focus-ring，不要直接用 accent／foreground／其他語意色').toEqual([]);
    });
  });
});
