/**
 * stop-detail-topbar-layout.test.tsx — PR5 TDD
 *
 * 驗證 StopDetailPage topbar 在 narrow viewport（375px）下的 DOM 結構：
 * 1. topbar header 存在
 * 2. 含 3 個直接 flex children（back-btn、crumb、TriplineLogo）
 * 3. TriplineLogo（<a href="/">）存在於 header 內
 * 4. crumb（.stop-detail-crumb）存在於 header 內
 * 5. crumb 有 min-width:0（防止 overflow）
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

describe('StopDetailPage — topbar narrow viewport layout (PR5)', () => {
  it('topbar header 存在', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    expect(header).not.toBeNull();
  });

  it('topbar 含 3 個直接 flex children（back-btn + crumb + TriplineLogo）', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    expect(header).not.toBeNull();
    // Direct children of the topbar header
    const children = header ? Array.from(header.children) : [];
    expect(children).toHaveLength(3);
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

  it('topbar 第三個 child 是 TriplineLogo（<a href="/">）', () => {
    const { container } = renderPage();
    const header = container.querySelector('header.stop-detail-topbar');
    const thirdChild = header?.children[2];
    expect(thirdChild?.tagName.toLowerCase()).toBe('a');
    expect(thirdChild?.getAttribute('href')).toBe('/');
  });

  it('crumb div 有 CSS class stop-detail-crumb（flex:1 + min-width:0 由 SCOPED_STYLES 保證）', () => {
    const { container } = renderPage();
    const crumb = container.querySelector('.stop-detail-crumb');
    expect(crumb).not.toBeNull();
  });

  it('SCOPED_STYLES 中 .stop-detail-crumb 含 min-width: 0（防止 narrow viewport overflow）', () => {
    // Read TripPage source and check that crumb has min-width:0
    // This is a static source assertion — verifies CSS is in place
    const { container: _c } = renderPage();
    // Check the <style> tag injected by StopDetailPage contains min-width: 0 for crumb
    const styleTags = document.querySelectorAll('style');
    const allStyles = Array.from(styleTags)
      .map((s) => s.textContent ?? '')
      .join('\n');
    // .stop-detail-crumb should have min-width: 0
    expect(allStyles).toMatch(/\.stop-detail-crumb\s*\{[^}]*min-width\s*:\s*0/);
  });
});
