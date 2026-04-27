import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useDragDrop } from '../../src/hooks/useDragDrop';

const USE_DRAG_DROP_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/hooks/useDragDrop.ts'),
  'utf8',
);

describe('useDragDrop', () => {
  it('provides pointer, touch, and keyboard sensors for shared drag context', () => {
    const { result } = renderHook(() => useDragDrop({ includeTouch: true }));
    expect(result.current.sensors).toHaveLength(3);
  });

  it('uses long-press touch activation to avoid mobile scroll conflicts', () => {
    expect(USE_DRAG_DROP_SRC).toContain('TouchSensor');
    expect(USE_DRAG_DROP_SRC).toContain('delay: touchActivationDelay');
    expect(USE_DRAG_DROP_SRC).toContain('tolerance: touchActivationTolerance');
  });

  it('supports sortable keyboard coordinates for itinerary reorder', () => {
    expect(USE_DRAG_DROP_SRC).toContain('sortableKeyboardCoordinates');
  });
});

describe('Keyboard a11y contract (Section 5)', () => {
  it('5.1 KeyboardSensor 由 useDragDrop 提供 → Space pickup + Arrow move + Enter drop', () => {
    expect(USE_DRAG_DROP_SRC).toContain('KeyboardSensor');
    // dnd-kit KeyboardSensor 預設 Space=pickup / Arrows=move / Enter=drop / Esc=cancel
    // sortableKeyboardCoordinates 提供垂直/水平箭頭算座標
    expect(USE_DRAG_DROP_SRC).toContain('sortableKeyboardCoordinates');
  });

  it('5.2 Esc cancel → dnd-kit KeyboardSensor 內建（無自定 sensor 覆寫）', () => {
    // useDragDrop 使用 dnd-kit 預設 KeyboardSensor，沒覆寫 keyboardCodes / activator
    // → Esc 取消為 dnd-kit built-in 行為，並由 TP_DRAG_ANNOUNCEMENTS.onDragCancel
    // 同時播報「拖動已取消，回原位」
    expect(USE_DRAG_DROP_SRC).not.toContain('keyboardCodes:');
    expect(USE_DRAG_DROP_SRC).not.toContain('activator:');
  });

  it('5.4 IdeasTabContent + TimelineRail 都套用中文 announcements', () => {
    const ideasSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/IdeasTabContent.tsx'),
      'utf8',
    );
    const timelineSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(ideasSrc).toContain('accessibility={TP_DRAG_ACCESSIBILITY}');
    expect(timelineSrc).toContain('accessibility={TP_DRAG_ACCESSIBILITY}');
  });
});
