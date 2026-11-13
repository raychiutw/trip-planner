/**
 * 帳號頁桌機版面 A（#1688，owner 2026-11-13 簽核）守門：
 * 單欄、個人卡橫式與設定格同寬、容器固定 1040（≥1440 不再攤開）、取代 2026-07-19 的「hero 收窄置中、設定兩欄」。
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = readFileSync('src/pages/AccountPage.tsx', 'utf8');
const styles = src.slice(src.indexOf('SCOPED_STYLES'), src.indexOf('interface SettingsRow'));
/** 取所有 `@media ... min-width: N px ...` 區塊內文（大括號配對、容許空白與 and 組合），多個區塊串接。 */
function media(minWidth: number): string {
  const head = new RegExp(`@media[^{]*min-width:\\s*${minWidth}\\s*px[^{]*\\{`, 'g');
  let out = '';
  for (let m = head.exec(styles); m; m = head.exec(styles)) {
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < styles.length && depth > 0; j++) {
      if (styles[j] === '{') depth++;
      else if (styles[j] === '}') depth--;
    }
    out += styles.slice(m.index + m[0].length, j - 1);
  }
  return out;
}

describe('帳號頁桌機版面 A', () => {
  const desktop = media(1024);
  it('≥1024：容器 max-width 1040（DESIGN.md Content Width）', () => {
    expect(desktop).toMatch(/\.tp-account-inner\s*\{[^}]*max-width:\s*1040px/);
  });
  it('個人卡不再收窄置中、設定分區不再兩欄', () => {
    expect(desktop).not.toMatch(/\.tp-account-hero\s*\{[^}]*max-width/);
    expect(styles).not.toMatch(/\.tp-account-groups\s*\{[^}]*grid-template-columns/);
    expect(desktop).not.toMatch(/\.tp-account-groups/);
  });
  it('≥1024：個人卡橫式（row），統計靠右', () => {
    expect(desktop).toMatch(/\.tp-account-hero\s*\{[^}]*flex-direction:\s*row/);
  });
  it('沒有 ≥1440 的版面分支（容器寬度不隨大視窗改變）', () => {
    const widths = [...styles.matchAll(/min-width:\s*(\d+)\s*px/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeLessThan(1440);
  });
  it('統計失敗列在統計區內（不再用獨立的 .tp-logout-stats-error）', () => {
    expect(src).not.toContain('tp-logout-stats-error');
    expect(src).not.toContain('數據載入失敗');
  });
  it('media() 取得所有同斷點區塊（不只第一個）', () => {
    expect(media(1024)).toContain('.tp-account-inner');
    expect(media(1024)).toContain('.tp-account-hero');
  });
  it('新增的 :focus-visible 帶內帶 box-shadow；sr-only 用全域 class', () => {
    expect(styles).toMatch(/\.tp-account-stats-error button:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 2px var\(--color-background\)/);
    expect(src).not.toContain('tp-account-sr-only');
  });
});
