/**
 * 深色第三欄 sheet 的局部色值對比守衛（#1423）。
 *
 * `body.dark .app-shell-sheet` 在 tertiary 表面內局部提亮 muted／destructive，這兩個值不是全站 token，
 * 所以 tokens-css／semantic-color-contrast 測試看不到它們：有人改了色值、對比掉到 4.5 以下，
 * 只有 e2e 的 axe 掃描（需要頁面剛好渲染該元素）會抓。這裡直接從 tokens.css 取值算對比。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from './__helpers__/wcag';

const css = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');

function must(re: RegExp, what: string): RegExpMatchArray {
  const m = css.match(re);
  if (!m) throw new Error(`tokens.css 找不到 ${what} — 選擇器或寫法改了？守衛不可靜默失效`);
  return m;
}

// 深色 tertiary：色票 override 區塊（含 --color-accent: 的那個 body.dark）裡的 --color-tertiary。
const darkBlock = [...css.matchAll(/body\.dark\s*\{([\s\S]*?)\}/g)].map((m) => m[1]).find((b) => b.includes('--color-accent:'));
if (!darkBlock) throw new Error('tokens.css 找不到深色色票區塊');
const TERTIARY = (darkBlock.match(/--color-tertiary:\s*(#[0-9A-Fa-f]{6})/) ?? [])[1];

const sheet = must(/body\.dark \.app-shell-sheet\s*\{\s*--color-muted:\s*(#[0-9A-Fa-f]{6});\s*--color-destructive:\s*(#[0-9A-Fa-f]{6});\s*\}/, '`body.dark .app-shell-sheet` 局部覆寫');
const contrastDestructive = must(/@media \(prefers-contrast: more\)\s*\{\s*body\.dark \.app-shell-sheet\s*\{\s*--color-destructive:\s*(#[0-9A-Fa-f]{6});/, '高對比下的 sheet destructive 還原');

describe('深色 sheet 局部色值（對 tertiary 表面）', () => {
  it('找得到深色 tertiary', () => { expect(TERTIARY, '深色 --color-tertiary').toMatch(/^#[0-9A-Fa-f]{6}$/); });
  it('muted 對 tertiary ≥ 4.5（全站 muted #A1A1A6 只有 4.41）', () => {
    expect(contrastRatio(sheet[1], TERTIARY)).toBeGreaterThanOrEqual(4.5);
  });
  it('destructive 對 tertiary ≥ 4.5（全站 #FF6B52 只有 4.04）', () => {
    expect(contrastRatio(sheet[2], TERTIARY)).toBeGreaterThanOrEqual(4.5);
  });
  it('提高對比時 destructive 比一般更高、且仍 ≥ 4.5（不可被局部覆寫蓋回一般值）', () => {
    expect(contrastRatio(contrastDestructive[1], TERTIARY)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(contrastDestructive[1], TERTIARY)).toBeGreaterThan(contrastRatio(sheet[2], TERTIARY));
  });
});
