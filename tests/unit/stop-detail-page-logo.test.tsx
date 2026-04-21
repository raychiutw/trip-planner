/**
 * stop-detail-page-logo.test.tsx — F006 TDD red test
 *
 * 驗證：StopDetailPage topbar 含 <TriplineLogo>（<a href="/"> with Tripline aria-label）。
 */

import { describe, it, expect, vi } from 'vitest';

/* ===== Mock TripContext ===== */
vi.mock('../../src/contexts/TripContext', () => ({
  useTripContext: () => ({
    trip: { id: 'test-trip', title: '測試行程' },
    allDays: { 1: { id: 1, date: '2026-07-27', label: '那霸', timeline: [], hotel: null } },
    loading: false,
  }),
}));

/* ===== Mock hooks ===== */
vi.mock('../../src/hooks/useScrollRestoreOnBack', () => ({
  useScrollRestoreOnBack: () => {},
}));

vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('../../src/hooks/useMapData', () => ({
  extractPinsFromDay: () => ({ pins: [] }),
}));

vi.mock('../../src/lib/mapDay', () => ({
  toTimelineEntry: (e: unknown) => e,
  findEntryInDays: () => null,
  formatDateLabel: (d: string | null) => d ?? '',
}));

/* ===== Mock react-router-dom ===== */
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useParams: () => ({ tripId: 'test-trip', entryId: '999' }),
    useNavigate: () => mockNavigate,
  };
});

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StopDetailPage from '../../src/pages/StopDetailPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/test-trip/stop/999']}>
      <StopDetailPage />
    </MemoryRouter>,
  );
}

describe('StopDetailPage — topbar 含 TriplineLogo (F006)', () => {
  it('topbar header 內含有 <a href="/"> 連結', () => {
    const { container } = renderPage();
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const homeLink = header?.querySelector('a[href="/"]');
    expect(homeLink).not.toBeNull();
  });

  it('topbar 內 <a href="/"> 的 aria-label 包含 "Tripline"', () => {
    const { container } = renderPage();
    const header = container.querySelector('header');
    const homeLink = header?.querySelector('a[href="/"]');
    expect(homeLink?.getAttribute('aria-label')).toMatch(/Tripline/);
  });
});
