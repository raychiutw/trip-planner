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
  it('TitleBar title 維持 activeTrip name（v2.18 design SoT, existing test pin）', () => {
    expect(SRC).toMatch(/<TitleBar\s+title=\{activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name\s*\|\|\s*['"]聊天['"]\}/);
  });

  it('Picker button 內不再 render trip name span', () => {
    expect(SRC).not.toMatch(/<span className="tp-titlebar-trip-picker-name">[\s\S]{0,80}activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name/);
  });

  it('Picker button 仍有 swap-horiz icon + chevron（affordance regression）', () => {
    expect(SRC).toMatch(/Icon\s+name=["']swap-horiz["']/);
    expect(SRC).toMatch(/tp-titlebar-trip-picker-chevron/);
  });

  it('Dropdown trip rows 維持顯每個 trip name（切換功能 regression）', () => {
    expect(SRC).toMatch(/tp-titlebar-trip-row-title[\s\S]{0,40}>\{?\s*t\.title\s*\|\|\s*t\.name/);
  });
});
