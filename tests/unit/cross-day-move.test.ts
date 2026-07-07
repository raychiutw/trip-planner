/**
 * buildCrossDayMoves — 跨天拖拉 batch payload 計算（2026-07-07）
 *
 * 驗：插中間（over item）/ 插末尾（rail container null）/ over 找不到 fallback
 * 末尾 / 防呆 target 列表含 active。sort_order 0-based 對齊 rail reorder 慣例。
 */
import { describe, it, expect } from 'vitest';
import { buildCrossDayMoves, railItemsFirstCollision } from '../../src/lib/crossDayMove';

describe('buildCrossDayMoves', () => {
  it('drop 在目標日某 entry 上 → 插該位，之後的依序 +1', () => {
    expect(buildCrossDayMoves(99, 7, [10, 20, 30], 20)).toEqual([
      { id: 99, day_id: 7, sort_order: 1 },
      { id: 20, sort_order: 2 },
      { id: 30, sort_order: 3 },
    ]);
  });

  it('drop 在 rail container（空白處/空日）→ 插末尾，不動既有', () => {
    expect(buildCrossDayMoves(99, 7, [10, 20], null)).toEqual([
      { id: 99, day_id: 7, sort_order: 2 },
    ]);
  });

  it('空日 → sort_order 0', () => {
    expect(buildCrossDayMoves(99, 7, [], null)).toEqual([
      { id: 99, day_id: 7, sort_order: 0 },
    ]);
  });

  it('overEntryId 不在目標列表（stale over）→ fallback 末尾', () => {
    expect(buildCrossDayMoves(99, 7, [10], 555)).toEqual([
      { id: 99, day_id: 7, sort_order: 1 },
    ]);
  });

  it('防呆：target 列表意外含 active → 先排除再算（不產生自我 +1）', () => {
    expect(buildCrossDayMoves(99, 7, [10, 99, 20], 20)).toEqual([
      { id: 99, day_id: 7, sort_order: 1 },
      { id: 20, sort_order: 2 },
    ]);
  });

  it('插第一位（over 目標日第一個 entry）', () => {
    expect(buildCrossDayMoves(99, 7, [10, 20], 10)).toEqual([
      { id: 99, day_id: 7, sort_order: 0 },
      { id: 10, sort_order: 1 },
      { id: 20, sort_order: 2 },
    ]);
  });
});

describe('railItemsFirstCollision（codex review P1：body droppable 蓋 rows 的 collision 修正）', () => {
  type C = { id: string; data: { current?: { railContainer?: boolean } } };
  const item = (id: string): C => ({ id, data: { current: {} } });
  const rail = (id: string): C => ({ id, data: { current: { railContainer: true } } });
  // fake closest：回傳「傳入的 containers」照序（模擬全部命中）
  const fakeClosest = (args: { droppableContainers: C[] }) =>
    args.droppableContainers.map((c) => ({ id: c.id }));

  it('有 sortable item 命中 → 只回 items（rail container 永不搶 tie）', () => {
    const hits = railItemsFirstCollision(fakeClosest, {
      droppableContainers: [rail('rail-1'), item('20'), item('30')],
    });
    expect(hits.map((h) => h.id)).toEqual(['20', '30']);
  });

  it('無 item（空日）→ fallback rail containers', () => {
    const hits = railItemsFirstCollision(fakeClosest, {
      droppableContainers: [rail('rail-1'), rail('rail-2')],
    });
    expect(hits.map((h) => h.id)).toEqual(['rail-1', 'rail-2']);
  });

  it('皆無 → 空陣列', () => {
    expect(railItemsFirstCollision(fakeClosest, { droppableContainers: [] })).toEqual([]);
  });
});
