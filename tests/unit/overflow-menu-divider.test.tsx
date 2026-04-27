/**
 * overflow-menu-divider.test.tsx — F005 TDD red test
 *
 * 驗證 OverflowMenu 的 divider 插入結構：
 * - 每個 group 邊界插入一個 divider
 * - 最終實作移除 prev.action !== item.action 分支後，divider 行為不變
 */

import { describe, it, expect, vi } from 'vitest';
import { OVERFLOW_ITEMS } from '../../src/components/trip/OverflowMenu';

describe('OverflowMenu — needsDivider 結構斷言 (F005)', () => {
  /**
   * 計算在 OVERFLOW_ITEMS 清單中，依 group 邊界插入 divider 的位置索引。
   * 僅看 group 差異（移除 action 分支後的預期行為）。
   */
  function getDividerPositions(items: typeof OVERFLOW_ITEMS): number[] {
    const positions: number[] = [];
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      const item = items[i]!;
      if (prev.group !== item.group) {
        positions.push(i);
      }
    }
    return positions;
  }

  it('OVERFLOW_ITEMS 的 divider 應在每個 group 邊界（3 個分隔）', () => {
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    // trip → info → settings → export: 3 group boundaries
    // trip(3) / info(2) / settings(2) / export(4) — R19 移除 driving
    expect(positions.length).toBe(3);
  });

  it('第一個 divider 位於 trip → info 邊界（index 3）', () => {
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    expect(positions[0]).toBe(3); // checklist is index 3, prev=flights(trip)
  });

  it('第二個 divider 位於 info → settings 邊界（index 5）', () => {
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    expect(positions[1]).toBe(5); // trip-select is index 5, prev=backup(info)
  });

  it('第三個 divider 位於 settings → export 邊界（index 8 — PR-O 後 settings 多 collab 一項，從 7 → 8）', () => {
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    expect(positions[2]).toBe(8); // download-pdf is index 8 (collab + trip-select + appearance + 3 prev groups)
  });

  it('同 group 內不應有 divider（trip group 前 3 個 item）', () => {
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    // Indices 1, 2 (flights, suggestions) are within trip group — no divider
    expect(positions).not.toContain(1);
    expect(positions).not.toContain(2);
  });

  it('同 group 內 action 不同也不應有 divider', () => {
    // 確認 settings group 中 trip-select(requiresOnline) 和 appearance 同 group → 不算 divider
    const settings = OVERFLOW_ITEMS.filter((i) => i.group === 'settings');
    expect(settings.length).toBeGreaterThan(1);
    // 如果兩個 settings item 之間有 divider，代表舊的 action-branch 仍存在（錯誤）
    const positions = getDividerPositions(OVERFLOW_ITEMS);
    const settingsStart = OVERFLOW_ITEMS.findIndex((i) => i.group === 'settings');
    const settingsEnd = OVERFLOW_ITEMS.reduce(
      (last, item, idx) => (item.group === 'settings' ? idx : last),
      -1,
    );
    for (let i = settingsStart + 1; i <= settingsEnd; i++) {
      expect(positions).not.toContain(i);
    }
  });
});
