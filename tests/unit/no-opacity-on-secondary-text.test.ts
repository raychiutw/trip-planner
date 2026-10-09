/**
 * 次要文字不得用 opacity 稀釋對比（#1423）。
 *
 * axe 的 color-contrast 對「內容只有 1 個字元」的元素歸到 incomplete 而非 violations，
 * e2e 全頁面掃描因此看不到單字元計數徽章；2026-10 這類徽章因 opacity .7／.85 稀釋掉對比
 * （2.75、4.06），axe 完全沒報，是靠像素取樣才量到。這裡直接守原始碼：這幾條規則的
 * 次要感必須由 --color-muted 之類的**文字色**承擔，不可再加 opacity。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '../../', p), 'utf8');
/** 取某條 CSS 規則（單一選擇器）大括號內的宣告；找不到就丟錯，避免選擇器改名後守衛靜默失效。 */
function rule(src: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = src.match(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`找不到規則 ${selector} — 選擇器改名了？守衛不可靜默失效`);
  return m[1];
}
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const CASES: Array<[string, string, string]> = [
  ['src/pages/ExplorePage.tsx', '.explore-subtab-count', '探索子分頁計數（單字元）'],
  ['src/pages/ExplorePage.tsx', '.explore-load-more.is-end', '探索結尾提示'],
  ['src/pages/PoiFavoritesPage.tsx', '.favorites-chip-count', '收藏分類計數（單字元）'],
  ['src/pages/AddEntryPage.tsx', '.tp-add-entry-section', '新增景點的預覽區塊'],
  ['src/pages/LoginPage.tsx', '.tp-bs-footnote', '登入 hero 頁尾（0.6 時只有 3.7）'],
];

describe('次要文字不用 opacity 稀釋對比', () => {
  for (const [file, sel, label] of CASES) {
    it(`${label}（${sel}）opacity 不得低於 0.8 且不得用在文字容器上稀釋 muted`, () => {
      const decl = stripComments(rule(read(file), sel));
      const m = decl.match(/opacity:\s*([\d.]+)/);
      // 允許 .tp-bs-footnote 這種 hero 頁尾保留 0.8（已實測 ≥ 4.9）；其餘一律不准出現 opacity。
      if (sel === '.tp-bs-footnote') {
        expect(Number(m?.[1] ?? 1), `${sel} opacity`).toBeGreaterThanOrEqual(0.8);
      } else {
        expect(m, `${sel} 又加了 opacity — 會把對比稀釋掉；改用 --color-muted 之類的文字色`).toBeNull();
      }
    });
  }
});
