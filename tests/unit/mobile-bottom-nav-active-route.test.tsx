/**
 * mobile-bottom-nav-active-route.test.tsx — PR3 review fix #2:
 * BottomNavBar active-tab 路由 regex 精確度測試
 *
 * 確保：
 * - `/manage/maptour-2026` 不應 active「地圖」（舊 includes('/map') 會誤判）
 * - `/trip/okinawa-trip-2026-Ray/map` 應 active「地圖」
 * - `/trip/test-trip` 應 active「行程」（exact trip route）
 * - `/manage/triphub` 不應 active「行程」
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNavBar from '../../src/components/shell/BottomNavBar';

const mockNavigate = vi.fn();

// We need a mutable location for these tests — use a variable the factory reads.
let mockPathname = '/trip/test-trip';

vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: mockPathname,
      search: '',
      hash: '',
      state: null,
      key: 'default',
    }),
  };
});

beforeEach(() => {
  mockNavigate.mockReset();
  mockPathname = '/trip/test-trip';
});

function renderNav(tripId = 'test-trip') {
  return render(
    <MemoryRouter initialEntries={[`/trip/${tripId}`]}>
      <BottomNavBar
        tripId={tripId}
        activeSheet={null}
        onOpenSheet={vi.fn()}
        isOnline
      />
    </MemoryRouter>,
  );
}

function getTabBtn(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(label),
  );
}

describe('BottomNavBar — active-tab route regex precision (PR3 fix #2)', () => {
  it('/trip/okinawa-trip-2026-Ray/map → 地圖 tab active', () => {
    mockPathname = '/trip/okinawa-trip-2026-Ray/map';
    const { container } = renderNav('okinawa-trip-2026-Ray');
    const mapBtn = getTabBtn(container, '地圖');
    expect(mapBtn?.getAttribute('aria-current')).toBe('page');
  });

  it('/manage/maptour-2026 → 地圖 tab NOT active (舊 includes 誤判防止)', () => {
    mockPathname = '/manage/maptour-2026';
    const { container } = renderNav();
    const mapBtn = getTabBtn(container, '地圖');
    expect(mapBtn?.getAttribute('aria-current')).toBeNull();
  });

  it('/trip/test-trip → 行程 tab active', () => {
    mockPathname = '/trip/test-trip';
    const { container } = renderNav();
    const homeBtn = getTabBtn(container, '行程');
    expect(homeBtn?.getAttribute('aria-current')).toBe('page');
  });

  it('/manage/triphub → 行程 tab NOT active', () => {
    mockPathname = '/manage/triphub';
    const { container } = renderNav();
    const homeBtn = getTabBtn(container, '行程');
    expect(homeBtn?.getAttribute('aria-current')).toBeNull();
  });
});
