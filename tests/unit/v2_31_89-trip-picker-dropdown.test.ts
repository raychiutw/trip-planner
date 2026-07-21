/**
 * v2.31.89：trip detail embedded TitleBar「切換行程」改 dropdown picker
 * （對齊 ChatPage TitleBar trip picker UX）。
 *
 * User feedback：「要用的下拉選單的版本的 icon」— v2.31.85 simple icon button
 * 改成 swap-horiz + chevron ▾ + dropdown 列 trips。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.89: TripsListPage embedded TitleBar trip picker dropdown', () => {
  const src = read('src/pages/TripsListPage.tsx');

  // 2026-07-21 形制變更（owner：「切換行程由 icon 改為點行程名稱 + V 下拉」）。
  // 本檔原本鎖 v2.31.89 的 `⇄ ▾` icon-only picker（TitleBar 右側 actions）。
  // 上一批換掉 ChatPage / MapPage 時漏了這頁 —— 而它正是 owner 截圖看到的那頁。
  it('改用共用的 TripTitleSwitcher，不再自帶 picker markup', () => {
    expect(read('src/pages/TripsListPage.tsx')).toMatch(/<TripTitleSwitcher/);
    expect(read('src/pages/TripsListPage.tsx'), 'owner 要求移除切換行程 icon').not.toMatch(/swap-horiz/);
    expect(read('src/pages/TripsListPage.tsx'), 'dropdown markup 由共用元件提供').not.toMatch(/tp-titlebar-trip-picker/);
  });
});
