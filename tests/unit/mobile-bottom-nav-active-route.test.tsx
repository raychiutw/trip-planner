/**
 * mobile-bottom-nav-active-route.test.tsx — PR3 review fix #2:
 * BottomNavBar active-tab 路由 regex 精確度測試
 *
 * 確保：
 * - `/chat/maptour-2026` 不應 active「地圖」（舊 includes('/map') 會誤判）
 * - `/trip/okinawa-trip-2026-Ray/map` 應 active「地圖」
 * - `/trip/test-trip` 應 active「行程」（exact trip route）
 *
 * Note: /manage 在 2026-04-26 廢棄並 redirect 到 /chat — 原本對
 * `/manage/triphub` 的「不應 active 行程」case 已不再 reachable。
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

  it('/chat/maptour-2026 → 地圖 tab NOT active (舊 includes 誤判防止)', () => {
    mockPathname = '/chat/maptour-2026';
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

  it('/chat → 訊息 tab active（取代舊 /manage editor）', () => {
    mockPathname = '/chat';
    const { container } = renderNav();
    const messageBtn = getTabBtn(container, '助理');
    expect(messageBtn?.getAttribute('aria-current')).toBe('page');
  });
});
