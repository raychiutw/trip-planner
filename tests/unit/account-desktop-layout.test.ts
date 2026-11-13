/**
 * 帳號頁桌機版面 A（#1688，owner 2026-11-13 簽核）守門：
 * 單欄、個人卡橫式與設定格同寬、容器固定 1040（≥1440 不再攤開）、取代 2026-07-19 的「hero 收窄置中、設定兩欄」。
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = readFileSync('src/pages/AccountPage.tsx', 'utf8');
const styles = src.slice(src.indexOf('SCOPED_STYLES'), src.indexOf('interface SettingsRow'));
/** 取 @media (min-width: N) 區塊內文（大括號配對）。 */
function media(minWidth: number): string {
  const i = styles.indexOf(`@media (min-width: ${minWidth}px)`);
  if (i < 0) return '';
  let depth = 0;
  for (let j = styles.indexOf('{', i); j < styles.length; j++) {
    if (styles[j] === '{') depth++;
    if (styles[j] === '}' && --depth === 0) return styles.slice(styles.indexOf('{', i) + 1, j);
  }
  return '';
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
    expect(styles).not.toMatch(/min-width:\s*1[4-9]\d\d px|min-width:\s*1[4-9]\d\dpx/);
  });
  it('統計失敗列在統計區內（不再用獨立的 .tp-logout-stats-error）', () => {
    expect(src).not.toContain('tp-logout-stats-error');
    expect(src).not.toContain('數據載入失敗');
  });
});
