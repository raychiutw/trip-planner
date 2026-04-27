/**
 * drag-announcements — keyboard / screen reader 中文化提示。
 *
 * Section 5 task 5.4：螢幕閱讀器於 drag 過程取得即時 announcement，落在
 * dnd-kit `<DndLiveRegion role="status" aria-live="assertive">`。
 */
import { describe, expect, it } from 'vitest';
import type { DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { TP_DRAG_ACCESSIBILITY, TP_DRAG_ANNOUNCEMENTS } from '../../src/lib/drag-announcements';

const stubActive = { id: 'idea-42', data: { current: undefined } } as unknown as DragStartEvent['active'];
const stubOver = { id: 'day-2', data: { current: undefined }, rect: { current: { initial: null, translated: null } }, disabled: false } as unknown as NonNullable<DragOverEvent['over']>;

describe('TP_DRAG_ANNOUNCEMENTS', () => {
  it('onDragStart 提示「已選取 + 操作鍵」', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragStart!({ active: stubActive });
    expect(msg).toContain('idea-42');
    expect(msg).toContain('方向鍵');
    expect(msg).toContain('Enter');
    expect(msg).toContain('Esc');
  });

  it('onDragOver 描述當前 over target', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragOver!({ active: stubActive, over: stubOver } as DragOverEvent);
    expect(msg).toContain('idea-42');
    expect(msg).toContain('day-2');
  });

  it('onDragOver 在無 over target 時提示未指向', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragOver!({ active: stubActive, over: null } as unknown as DragOverEvent);
    expect(msg).toContain('未指向');
  });

  it('onDragEnd 完成播報目的地', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragEnd!({ active: stubActive, over: stubOver } as DragEndEvent);
    expect(msg).toContain('已放下');
    expect(msg).toContain('day-2');
  });

  it('onDragEnd 無 over → 操作取消', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragEnd!({ active: stubActive, over: null } as unknown as DragEndEvent);
    expect(msg).toContain('取消');
  });

  it('onDragCancel 播報已取消 + 回原位', () => {
    const msg = TP_DRAG_ANNOUNCEMENTS.onDragCancel!({ active: stubActive } as DragCancelEvent);
    expect(msg).toContain('已取消');
    expect(msg).toContain('回原位');
  });

  it('TP_DRAG_ACCESSIBILITY 匯出供 DndContext accessibility prop', () => {
    expect(TP_DRAG_ACCESSIBILITY.announcements).toBe(TP_DRAG_ANNOUNCEMENTS);
  });
});
