/**
 * TripSheetTabs — keyboard navigation 測試（B-P6 task 5.3）
 *
 * W3C ARIA tabs pattern keyboard 規範：
 * - ArrowRight：focus 下一個 tab，活化它（循環到頭尾）
 * - ArrowLeft：focus 前一個 tab，活化它
 * - Home：跳第一個 tab
 * - End：跳最後一個 tab
 * - 切換後 focus 必須移到新 active tab button
 *
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TripSheetTabs from '../../src/components/trip/TripSheetTabs';
import { sheetTabId, type SheetTab } from '../../src/lib/trip-url';

function setup(currentTab: SheetTab = 'map') {
  const onChange = vi.fn();
  const utils = render(<TripSheetTabs currentTab={currentTab} onChange={onChange} />);
  return { ...utils, onChange };
}

function getTablist(container: HTMLElement) {
  const el = container.querySelector('[role="tablist"]') as HTMLElement;
  if (!el) throw new Error('tablist not found');
  return el;
}

describe('TripSheetTabs — keyboard navigation', () => {
  it('ArrowRight 切到下一個 tab（itinerary→ideas）', () => {
    const { container, onChange } = setup('itinerary');
    fireEvent.keyDown(getTablist(container), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('ideas');
  });

  it('ArrowRight 從最後一個 tab（chat）循環回第一個（itinerary）', () => {
    const { container, onChange } = setup('chat');
    fireEvent.keyDown(getTablist(container), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('itinerary');
  });

  it('ArrowLeft 切到前一個 tab（map→ideas）', () => {
    const { container, onChange } = setup('map');
    fireEvent.keyDown(getTablist(container), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('ideas');
  });

  it('ArrowLeft 從第一個 tab（itinerary）循環到最後（chat）', () => {
    const { container, onChange } = setup('itinerary');
    fireEvent.keyDown(getTablist(container), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('chat');
  });

  it('Home 跳第一個 tab', () => {
    const { container, onChange } = setup('map');
    fireEvent.keyDown(getTablist(container), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('itinerary');
  });

  it('End 跳最後一個 tab', () => {
    const { container, onChange } = setup('itinerary');
    fireEvent.keyDown(getTablist(container), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('chat');
  });

  it('其他 key（如 Enter / Space）不觸發 onChange（讓 click handler 處理）', () => {
    const { container, onChange } = setup('map');
    fireEvent.keyDown(getTablist(container), { key: 'Enter' });
    fireEvent.keyDown(getTablist(container), { key: ' ' });
    fireEvent.keyDown(getTablist(container), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ArrowRight preventDefault — 避免頁面 horizontal scroll', () => {
    const { container } = setup('map');
    // fireEvent return false 代表 event 被 cancel（preventDefault called）
    const notDefault = fireEvent.keyDown(getTablist(container), { key: 'ArrowRight' });
    expect(notDefault).toBe(false);
  });

  it('切換後 focus 移到新 active tab button', () => {
    const { container, rerender } = setup('itinerary');
    fireEvent.keyDown(getTablist(container), { key: 'ArrowRight' });
    // 模擬 parent re-render（onChange 更新 URL → location.search → currentTab='ideas'）
    rerender(<TripSheetTabs currentTab="ideas" onChange={vi.fn()} />);
    const ideasBtn = container.querySelector(`#${sheetTabId('ideas')}`);
    expect(document.activeElement).toBe(ideasBtn);
  });
});
