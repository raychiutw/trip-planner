/**
 * TripSheet — ARIA tabs pattern 完整關聯測試（B-P6 task 5.4）
 *
 * WCAG ARIA tabs pattern 要求：
 * - 每個 [role=tab] 需 unique `id` + `aria-controls` 指向對應 tabpanel
 * - 每個 [role=tabpanel] 需 unique `id` + `aria-labelledby` 指回對應 tab
 * - 全部 4 個 tabpanel 都該存在 DOM 用 `hidden` 切換（不能 conditional unmount，否則 aria-controls 指向不存在的 element）
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TripSheet from '../../src/components/trip/TripSheet';
import { SHEET_TABS, sheetTabId, sheetPanelId } from '../../src/lib/trip-url';

function renderSheet(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <TripSheet tripId="test-trip" allPins={[]} pinsByDay={new Map()} />
    </MemoryRouter>,
  );
}

describe('TripSheet — ARIA tabs pattern 完整關聯', () => {
  it('每個 role=tab 都有 id + aria-controls 指向對應 tabpanel', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(SHEET_TABS.length);
    SHEET_TABS.forEach((tab) => {
      const el = container.querySelector(`#${sheetTabId(tab)}`);
      expect(el, `tab ${tab} 必須有 id=${sheetTabId(tab)}`).toBeTruthy();
      expect(el?.getAttribute('aria-controls')).toBe(sheetPanelId(tab));
    });
  });

  it('每個 role=tabpanel 都有 id + aria-labelledby 指回對應 tab', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels.length, '4 個 tabpanel 都要 in DOM (用 hidden 切換)').toBe(SHEET_TABS.length);
    SHEET_TABS.forEach((tab) => {
      const el = container.querySelector(`#${sheetPanelId(tab)}`);
      expect(el, `panel ${tab} 必須有 id=${sheetPanelId(tab)}`).toBeTruthy();
      expect(el?.getAttribute('role')).toBe('tabpanel');
      expect(el?.getAttribute('aria-labelledby')).toBe(sheetTabId(tab));
    });
  });

  it('當 ?sheet=map 時 only map panel 不 hidden，其他 3 個 hidden', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=map');
    SHEET_TABS.forEach((tab) => {
      const el = container.querySelector(`#${sheetPanelId(tab)}`);
      const hidden = el?.hasAttribute('hidden');
      if (tab === 'map') {
        expect(hidden, 'active panel (map) 不該 hidden').toBe(false);
      } else {
        expect(hidden, `inactive panel (${tab}) 該 hidden`).toBe(true);
      }
    });
  });

  it('aria-selected 對應當前 tab', () => {
    const { container } = renderSheet('/trip/test-trip?sheet=ideas');
    const ideasTab = container.querySelector(`#${sheetTabId('ideas')}`);
    expect(ideasTab?.getAttribute('aria-selected')).toBe('true');
    const mapTab = container.querySelector(`#${sheetTabId('map')}`);
    expect(mapTab?.getAttribute('aria-selected')).toBe('false');
  });
});
