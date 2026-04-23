/**
 * stop-detail-topbar-layout.test.tsx
 *
 * 驗證 StopDetailPage topbar 在 narrow viewport（375px）下的 DOM 結構：
 * 1. topbar header 存在
 * 2. 含 2 個直接 flex children（back-btn、crumb）— logo 已移除
 * 3. crumb（.stop-detail-crumb）存在於 header 內
 * 4. crumb 有 min-width:0（防止 overflow）
 * 5. header 內不再含 <a href="/"> home link（TriplineLogo 已整體移除）
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

describe('StopDetailPage — topbar narrow viewport layout', () => {
  it('topbar header 存在', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    expect(header).not.toBeNull();
  });

  it('topbar 含 2 個直接 flex children（back-btn + crumb）', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    expect(header).not.toBeNull();
    const children = header ? Array.from(header.children) : [];
    expect(children).toHaveLength(2);
  });

  it('topbar 第一個 child 是 back button（button.stop-detail-back）', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    const firstChild = header?.children[0];
    expect(firstChild?.tagName.toLowerCase()).toBe('button');
    expect(firstChild?.classList.contains('stop-detail-back')).toBe(true);
  });

  it('topbar 第二個 child 是 crumb（div.stop-detail-crumb）', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    const secondChild = header?.children[1];
    expect(secondChild?.classList.contains('stop-detail-crumb')).toBe(true);
  });

  it('topbar 內不再含 home link（<a href="/">）— TriplineLogo 已移除', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    const homeLink = header?.querySelector('a[href="/"]');
    expect(homeLink).toBeNull();
  });

  it('crumb div 有 CSS class stop-detail-crumb（flex:1 + min-width:0 由 SCOPED_STYLES 保證）', () => {
    const { container } = renderPage();
    const crumb = container.querySelector('.stop-detail-crumb');
    expect(crumb).not.toBeNull();
  });

  it('SCOPED_STYLES 中 .stop-detail-crumb 含 min-width: 0（防止 narrow viewport overflow）', () => {
    const { container: _c } = renderPage();
    const styleTags = document.querySelectorAll('style');
    const allStyles = Array.from(styleTags)
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(allStyles).toMatch(/\.stop-detail-crumb\s*\{[^}]*min-width\s*:\s*0/);
  });
});
