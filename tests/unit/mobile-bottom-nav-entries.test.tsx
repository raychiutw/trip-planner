/**
 * mobile-bottom-nav-entries.test.tsx
 *
 * SUPERSEDED by mobile-bottom-nav-route.test.tsx (PR3 — 4-tab route-based).
 * This file is kept as a historic artifact of the 5-tab API.
 *
 * All meaningful tests have been migrated to mobile-bottom-nav-route.test.tsx
 * which exercises the new tripId + useNavigate + useLocation API.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNavBar from '../../src/components/shell/BottomNavBar';

function renderNav(overrides: Partial<Parameters<typeof BottomNavBar>[0]> = {}) {
  const defaults = {
    tripId: 'test-trip',
    activeSheet: null,
    onOpenSheet: vi.fn(),
    onClearSheet: vi.fn(),
    isOnline: true,
  };
  return render(
    <MemoryRouter initialEntries={['/trip/test-trip']}>
      <BottomNavBar {...defaults} {...overrides} />
    </MemoryRouter>,
  );
}

describe('BottomNavBar — 4 個 tab 全部存在（PR3）', () => {
  it('「行程」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '行程' })).toBeTruthy();
  });

  it('「地圖」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '地圖' })).toBeTruthy();
  });

  it('「助理」tab render 且有 aria-label（F009: 訊息 → 助理）', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '助理' })).toBeTruthy();
  });

  it('「更多」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '更多' })).toBeTruthy();
  });

  it('「更多」按鈕 click 觸發 onOpenSheet("action-menu")', () => {
    const onOpenSheet = vi.fn();
    const { getByRole } = renderNav({ onOpenSheet });
    getByRole('button', { name: '更多' }).click();
    expect(onOpenSheet).toHaveBeenCalledWith('action-menu');
  });
});
