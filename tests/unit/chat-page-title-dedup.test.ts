// @vitest-environment node
/**
 * v2.31.47 polish: ChatPage TitleBar 跟 trip picker button 重複顯 trip name。
 *
 * Bug 取證（prod QA loop, desktop & mobile）：
 *   - TitleBar `title` (line 713-714) 顯 activeTrip name（v2.18 design SoT，
 *     對齊 existing test `chat-page-ai-avatar` line 134「TitleBar title 為
 *     當前 trip name (取代「聊天」固定 title)」）。
 *   - Trip picker button 內也加了 `<span class="tp-titlebar-trip-picker-name">`
 *     顯**同樣** trip name (line 727-729) → 視覺冗餘 +「2026 沖繩... ⇄
 *     2026 沖繩...」重複。
 *
 * 第一輪 fix 嘗試把 title 改回固定「聊天」（page label convention）— 但
 * existing test `chat-page-ai-avatar.test.tsx:134` 已 codify「title=trip name」
 * 為 design intent，改 title 破壞 SoT。
 *
 * 正確 fix：title 維持 trip name；**picker button 拔掉 trip name span**，只留
 * ⇄ icon + ▾ chevron（user click 開 dropdown 看完整 trip list）。
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
  it('TitleBar title 維持 activeTrip name（v2.18 design SoT）', () => {
    expect(SRC).toMatch(/<TitleBar\s+title=\{activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name\s*\|\|\s*['"]聊天['"]\}/);
  });

  it('Picker button 內不再 render trip name span（避免跟 title 重複）', () => {
    // 拿掉 `<span class="tp-titlebar-trip-picker-name">{activeTrip?.title || ...}</span>`
    expect(SRC).not.toMatch(/tp-titlebar-trip-picker-name[^>]*>\s*\{?[\s\S]*?activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name/);
  });

  it('Picker button 仍有 swap-horiz icon + chevron（affordance regression）', () => {
    expect(SRC).toMatch(/Icon\s+name=["']swap-horiz["']/);
    expect(SRC).toMatch(/tp-titlebar-trip-picker-chevron/);
  });

  it('Dropdown trip rows 維持顯每個 trip name（切換功能 regression）', () => {
    expect(SRC).toMatch(/tp-titlebar-trip-row-title[\s\S]{0,40}>\{?\s*t\.title\s*\|\|\s*t\.name/);
  });
});
