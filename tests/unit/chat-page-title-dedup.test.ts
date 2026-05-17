// @vitest-environment node
/**
 * v2.31.47 polish: ChatPage TitleBar 重複顯示 trip name。
 *
 * Bug 取證（prod QA loop, desktop & mobile）：
 *   - ChatPage TitleBar `title` (line 714) 顯 `activeTrip?.title || ... || '聊天'`
 *   - 同一 row 的 `actions` 區（trip picker button）也顯同樣的 trip name
 *   - User 看到「2026 沖繩五日自駕遊行程表 ⇄ 2026 沖繩五日自駕遊...」
 *     兩個都是同一字串，視覺冗餘 + 信息重複。
 *
 * Design 意圖：title 應該是 **page label**（「聊天」），actions 才是 active trip
 * 顯示 + switcher（其他 page e.g. SessionsPage title「登入裝置」/ AppearancePage
 * title「外觀設定」都是 page label not data）。
 *
 * Fix：`title` 永遠固定「聊天」字串；actions 的 trip picker 維持顯 trip name。
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

describe('v2.31.47 ChatPage TitleBar title 改固定「聊天」', () => {
  it('TitleBar title 是 string literal「聊天」，非 activeTrip 動態值', () => {
    // 預期：`<TitleBar` 後緊接 `title="聊天"` (literal) 或 `title={'聊天'}` 形式
    // 不再用 `title={activeTrip?.title || activeTrip?.name || '聊天'}`
    expect(SRC).toMatch(/<TitleBar\s+title=["']聊天["']/);
  });

  it('actions trip picker 維持顯 activeTrip name（regression: 切換 trip 仍可用）', () => {
    // picker button span 仍含 activeTrip name 來源
    expect(SRC).toMatch(/tp-titlebar-trip-picker-name[\s\S]*?activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name/);
  });

  it('不再 dual-render activeTrip name 為 title', () => {
    // 拿掉 `title={activeTrip?.title || activeTrip?.name || '聊天'}` 模式
    expect(SRC).not.toMatch(/title=\{activeTrip\?\.title\s*\|\|\s*activeTrip\?\.name\s*\|\|\s*['"]聊天['"]\}/);
  });
});
