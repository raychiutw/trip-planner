/**
 * 次要文字不得用 opacity 稀釋對比（#1423）。
 *
 * axe 的 color-contrast 對「內容只有 1 個字元」的元素歸到 incomplete 而非 violations，
 * e2e 全頁面掃描因此看不到單字元計數徽章；2026-10 這類徽章因 opacity .7／.85 稀釋掉對比
 * （2.75、4.06），axe 完全沒報，是靠像素取樣才量到。這裡直接守原始碼：這幾條規則的
 * 次要感必須由 --color-muted 之類的**文字色**承擔，不可再加 opacity。
 * 例外：登入／註冊的 hero 頁尾（.tp-bs-footnote）允許 opacity，但不得低於 FOOTNOTE_MIN_OPACITY。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssRule, stripCssComments } from './__helpers__/wcag';

const read = (p: string) => readFileSync(join(__dirname, '../../', p), 'utf8');
// 第四欄 minOpacity：undefined = 不得出現 opacity；有值 = 允許但不得低於該值（hero 頁尾已實測 ≥ 4.9）。
const FOOTNOTE_MIN_OPACITY = 0.8;
const CASES: Array<[string, string, string, number?]> = [
  ['src/pages/ExplorePage.tsx', '.explore-subtab-count', '探索子分頁計數（單字元）'],
  ['src/pages/ExplorePage.tsx', '.explore-load-more.is-end', '探索結尾提示'],
  ['src/pages/PoiFavoritesPage.tsx', '.favorites-chip-count', '收藏分類計數（單字元）'],
  ['src/pages/AddEntryPage.tsx', '.tp-add-entry-section', '新增景點的預覽區塊'],
  ['src/pages/LoginPage.tsx', '.tp-bs-footnote', '登入 hero 頁尾（0.6 時只有 3.7）', FOOTNOTE_MIN_OPACITY],
  ['src/components/auth/AuthBrandHero.tsx', '.tp-bs-footnote', '註冊／忘記密碼 hero 頁尾（與 LoginPage 同形的另一份）', FOOTNOTE_MIN_OPACITY],
];

/** 只認真正的 opacity 屬性（不吃 fill-opacity／stop-opacity）；值可能是 var() 之類的非數字。 */
const OPACITY_DECL = /(?:^|[;\s{])opacity\s*:\s*([^;}]+)/;

describe('次要文字不用 opacity 稀釋對比', () => {
  for (const [file, sel, label, minOpacity] of CASES) {
    it(`${label}（${sel}）${minOpacity === undefined ? '不得有 opacity' : `opacity 不得低於 ${minOpacity}`}`, () => {
      const decl = stripCssComments(cssRule(read(file), sel));
      const m = decl.match(OPACITY_DECL);
      if (minOpacity === undefined) {
        expect(m, `${sel} 又加了 opacity — 會把對比稀釋掉；改用 --color-muted 之類的文字色`).toBeNull();
      } else {
        const v = m ? Number(m[1].trim()) : 1;
        expect(Number.isFinite(v), `${sel} opacity 不是數字（${m?.[1]}）— 無法驗證下限`).toBe(true);
        expect(v, `${sel} opacity`).toBeGreaterThanOrEqual(minOpacity);
      }
    });
  }
});
