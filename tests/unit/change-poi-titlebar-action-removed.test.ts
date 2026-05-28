/**
 * ChangePoiPage titleBar 右上 ✓ submit action 拔除 — v2.33.141
 *
 * User feedback 2026-05-28：「右上角紅框移除」(screenshot 加入備選景點 page)。
 * /change-poi /add-entry /alternates 3 mode 共用 ChangePoiPage，bottom sticky
 * bar 已有 primary button 同 submitLabel（加為備選 / 加入行程 / 置換景點），
 * titleBar 右上 ✓ 完全重複。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

describe('ChangePoiPage titleBar right action 拔除', () => {
  it('TitleBarPrimaryAction 不再 import', () => {
    expect(SRC).not.toMatch(/import TitleBarPrimaryAction from/);
  });

  it('titleBarActions useMemo 已拔', () => {
    expect(SRC).not.toMatch(/const titleBarActions = useMemo/);
  });

  it('change-poi-titlebar-submit testid 不存在', () => {
    expect(SRC).not.toMatch(/change-poi-titlebar-submit/);
  });

  it('TitleBar 無 actions prop', () => {
    // 取主 JSX `<TitleBar title={pageTitle} back={goBack} ... />`
    const m = SRC.match(/<TitleBar title=\{pageTitle\}[\s\S]{0,200}?\/>/);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/actions=/);
  });

  it('全檔搜尋無 titleBarActions identifier 殘留', () => {
    // 簡單 grep — 整檔不應有 titleBarActions（變數 + deps array 全清）
    expect(SRC).not.toMatch(/titleBarActions/);
  });

  it('bottom sticky bar primary button (change-poi-submit) 仍存在 — 唯一 submit 入口', () => {
    expect(SRC).toMatch(/data-testid="change-poi-submit"/);
  });

  it('注解引用 v2.33.141 + user feedback「右上角紅框移除」', () => {
    expect(SRC).toMatch(/v2\.33\.141.*右上角紅框移除|右上角紅框移除.*v2\.33\.141/s);
  });
});
