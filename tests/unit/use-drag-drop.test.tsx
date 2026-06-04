import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MouseSensor, PointerSensor, TouchSensor } from '@dnd-kit/core';
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

  it('5.4 TimelineRail 套用中文 announcements (IdeasTabContent retired in V2 cutover)', () => {
    const timelineSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(timelineSrc).toContain('accessibility={TP_DRAG_ACCESSIBILITY}');
  });
});

describe('touch/mouse sensor separation (drag vs scroll conflict fix)', () => {
  it('includeTouch routes mouse via MouseSensor + touch via delay TouchSensor — never PointerSensor (which hijacks touch scroll)', () => {
    const { result } = renderHook(() =>
      useDragDrop({ includeTouch: true, pointerActivationDistance: 8 }),
    );
    const sensorClasses = result.current.sensors.map((descriptor) => descriptor.sensor);
    expect(sensorClasses).toContain(MouseSensor);
    expect(sensorClasses).toContain(TouchSensor);
    // PointerSensor receives touch via pointer events with NO delay and out-races the
    // 200ms TouchSensor, turning a vertical scroll swipe into an accidental reorder.
    // It must not drive the timeline when touch is enabled.
    expect(sensorClasses).not.toContain(PointerSensor);
  });

  it('desktop mouse drag stays instant (distance), touch requires ~200ms press-and-hold', () => {
    const { result } = renderHook(() =>
      useDragDrop({ includeTouch: true, pointerActivationDistance: 8 }),
    );
    const mouse = result.current.sensors.find((descriptor) => descriptor.sensor === MouseSensor);
    const touch = result.current.sensors.find((descriptor) => descriptor.sensor === TouchSensor);
    expect(mouse?.options?.activationConstraint).toEqual({ distance: 8 });
    expect(touch?.options?.activationConstraint).toMatchObject({ delay: 200, tolerance: 5 });
  });

  it('pointer-only contexts (includeTouch=false) keep PointerSensor for mouse + pen', () => {
    const { result } = renderHook(() => useDragDrop());
    const sensorClasses = result.current.sensors.map((descriptor) => descriptor.sensor);
    expect(sensorClasses).toContain(PointerSensor);
    expect(sensorClasses).not.toContain(TouchSensor);
    expect(sensorClasses).not.toContain(MouseSensor);
  });
});

describe('TimelineRail grip touch-action (drag vs scroll conflict fix)', () => {
  const TIMELINE_RAIL_SRC = fs.readFileSync(
    path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
    'utf8',
  );

  it('grip no longer pins touch-action:none (which blocked native scroll → dead-zone)', () => {
    expect(TIMELINE_RAIL_SRC).not.toContain('touch-action: none');
  });

  it('grip allows vertical pan so a quick swipe scrolls while a long-press still drags', () => {
    expect(TIMELINE_RAIL_SRC).toContain('touch-action: pan-y');
  });
});
