// @vitest-environment node
/**
 * v2.31.47 polish: ChatPage TitleBar title 跟 trip picker button 都顯
 * activeTrip name → 視覺冗餘「2026 沖繩... ⇄ 2026 沖繩...」。
 *
 * Existing test `chat-page-ai-avatar.test.tsx:134` codify title=trip name 是
 * v2.18 起 design SoT，不能動 title。
 *
 * Fix：picker button 拔掉 trip name span，只留 ⇄ icon + ▾ chevron 當切換
 * affordance；user click 開 dropdown 看完整 trip list（dropdown rows 仍顯
 * 每個 trip name）。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ChatPage.tsx'),
  'utf8',
);

describe('v2.31.47 ChatPage picker button 不重複 trip name', () => {
  // 2026-07-21 形制變更（owner：「移除切換行程 icon，改為點下行程名稱後切換，
  // 行程名稱後面接一個 V 符號」）。本檔原本鎖的是 v2.31.47 的形制：標題是純字串、
  // 右側一顆 `⇄ ▾` 圖示按鈕。那顆按鈕與標題分離，使用者要先認出圖示才知道能換。
  // 現在標題自己是按鈕、後面掛 chevron，dropdown 邏輯抽到 TripTitleSwitcher。

  it('標題改用共用的 TripTitleSwitcher', () => {
    expect(SRC).toMatch(/<TripTitleSwitcher/);
    expect(SRC).toMatch(/label=\{activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name/);
  });

  it('不再有分離的 swap-horiz 圖示按鈕', () => {
    expect(SRC, 'owner 要求移除切換行程 icon').not.toMatch(/swap-horiz/);
    expect(SRC).not.toMatch(/tp-titlebar-trip-picker-chevron/);
  });

  it('dropdown 的 trip name 渲染已移到共用元件（本頁不再重複實作）', () => {
    expect(SRC, 'markup 應由 TripTitleSwitcher 提供').not.toMatch(/tp-titlebar-trip-row-title/);
  });
});
