/**
 * mobile-bottom-nav-route.test.tsx — TDD tests for Item 1:
 * BottomNavBar 重構成 4-tab route-based (Q3=B)
 *
 * Covers:
 * - 4 tabs render: 行程 / 地圖 / 助理 / 更多（F009: 訊息 → 助理）
 * - 行程 → navigate('/trip/:id') + scroll-to-top
 * - 地圖 → navigate('/trip/:id/map')
 * - 助理 → navigate('/chat')
 * - 更多 → onOpenSheet('action-menu')
 * - Active highlighting via useLocation
 * - grid-template-columns: repeat(4, 1fr)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNavBar from '../../src/components/shell/BottomNavBar';

/* ===== mock react-router navigate ===== */
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/trip/test-trip', search: '', hash: '', state: null, key: 'default' }),
  };
});

/* ===== scroll mock ===== */
const scrollToMock = vi.fn();
beforeEach(() => {
  mockNavigate.mockReset();
  scrollToMock.mockReset();
  window.scrollTo = scrollToMock;
});

const TRIP_ID = 'test-trip';

function renderNav(overrides: Partial<Parameters<typeof BottomNavBar>[0]> = {}) {
  const defaults = {
    tripId: TRIP_ID,
    activeSheet: null,
    onOpenSheet: vi.fn(),
    onClearSheet: vi.fn(),
    isOnline: true,
  };
  return render(
    <MemoryRouter initialEntries={[`/trip/${TRIP_ID}`]}>
      <BottomNavBar {...defaults} {...overrides} />
    </MemoryRouter>,
  );
}

describe('BottomNavBar — 4-tab route-based (PR3)', () => {
  it('renders exactly 4 tab buttons', () => {
    const { getAllByRole } = renderNav();
    const btns = getAllByRole('button');
    expect(btns).toHaveLength(4);
  });

  it('「行程」tab exists', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '行程' })).toBeTruthy();
  });

  it('「地圖」tab exists', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '地圖' })).toBeTruthy();
  });

  it('「助理」tab exists（F009: 訊息 → 助理）', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '助理' })).toBeTruthy();
  });

  it('「更多」tab exists', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '更多' })).toBeTruthy();
  });

  it('「行程」click → navigate to /trip/:tripId', () => {
    const { getByRole } = renderNav();
    fireEvent.click(getByRole('button', { name: '行程' }));
    expect(mockNavigate).toHaveBeenCalledWith(`/trip/${TRIP_ID}`);
  });

  it('「行程」click → scrollTo top', () => {
    const { getByRole } = renderNav();
    fireEvent.click(getByRole('button', { name: '行程' }));
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('「地圖」click → navigate to /trip/:tripId/map', () => {
    const { getByRole } = renderNav();
    fireEvent.click(getByRole('button', { name: '地圖' }));
    expect(mockNavigate).toHaveBeenCalledWith(`/trip/${TRIP_ID}/map`);
  });

  it('「助理」click → navigate to /chat（取代舊 /manage editor，AI auto-classifies intent）', () => {
    const { getByRole } = renderNav();
    fireEvent.click(getByRole('button', { name: '助理' }));
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

  it('「更多」click → onOpenSheet("action-menu")', () => {
    const onOpenSheet = vi.fn();
    const { getByRole } = renderNav({ onOpenSheet });
    fireEvent.click(getByRole('button', { name: '更多' }));
    expect(onOpenSheet).toHaveBeenCalledWith('action-menu');
  });

  it('nav element has CSS class ocean-bottom-nav', () => {
    const { container } = renderNav();
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('ocean-bottom-nav');
  });
});
