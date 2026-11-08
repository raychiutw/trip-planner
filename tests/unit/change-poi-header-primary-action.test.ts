/**
 * ChangePoiPage 主要動作位置 — #1559（取代 v2.33.141 的 change-poi-titlebar-action-removed）
 *
 * v2.33.141（2026-05-28）曾拔掉標題列右上 ✓，理由是底部列已有同 label 的主要按鈕、兩者重複。
 * #1559 owner 定案相反方向：表單頁主要動作一律放標題列、底部列退役。
 * 因此：submit 唯一入口改為標題列（OperationShell 的 primaryAction），不再有底部列與取消鈕。
 * 「不重複」的精神保留：整檔只能有一個 change-poi-submit。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

describe('ChangePoiPage 主要動作在標題列（#1559）', () => {
  it('用 TitleBarPrimaryAction 當 OperationShell 的 primaryAction', () => {
    expect(SRC).toMatch(/import TitleBarPrimaryAction from/);
    expect(SRC).toMatch(/primaryAction=\{\s*<TitleBarPrimaryAction/);
  });

  it('change-poi-submit 只出現一次（標題列是唯一 submit 入口）', () => {
    expect(SRC.match(/change-poi-submit/g)).toHaveLength(1);
  });

  it('底部列與取消鈕退役', () => {
    expect(SRC).not.toMatch(/tp-page-bottom-bar/);
    expect(SRC).not.toMatch(/change-poi-cancel/);
  });

  it('OperationShell 沒有 actions prop，也沒有舊的 titleBarActions', () => {
    expect(SRC).not.toMatch(/actions=/);
    expect(SRC).not.toMatch(/titleBarActions/);
  });
});
