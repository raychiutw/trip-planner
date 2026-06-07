/**
 * AddPoiFavoriteToTripPage 7-state matrix + skeleton test (§12.4 + §12.8)
 *
 * 對齊 DESIGN.md L604-614 + mockup B3/B5：
 *   loading / empty-no-trip / conflict / error / success / optimistic / partial
 *   trip 切換時 day select 顯示 tp-skel skeleton + submit disabled
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { pickFromTripSelect } from './__helpers__/tripSelect';
import { pickTime } from './__helpers__/tripTimePicker';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

import { ApiError } from '../../src/lib/errors';

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => () => {},
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';

const SAMPLE_FAVORITE = {
  id: 5,
  poiId: 100,
  poiName: 'POI test',
  poiAddress: 'addr',
  poiType: 'restaurant',
  favoritedAt: '2026-04-01T00:00:00Z',
  note: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/favorites/5/add-to-trip']}>
      <Routes>
        <Route path="/favorites/:id/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('AddPoiFavoriteToTripPage — 7-state matrix', () => {
  it('state=loading: aria-busy="true" + tp-skel skeleton', async () => {
    apiFetchMock.mockImplementation(() => new Promise(() => {})); // pending
    renderPage();
    const loading = await waitFor(() => screen.getByTestId('favorites-add-to-trip-loading'));
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelectorAll('.tp-skel').length).toBeGreaterThan(0);
  });

  it('state=empty-no-trip: tp-empty-cta + 「建立第一個行程」link', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
      if (path === '/my-trips') return Promise.resolve([]);
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-empty')).toBeTruthy());
    const empty = screen.getByTestId('favorites-add-to-trip-empty');
    expect(empty.textContent).toContain('還沒有');
    const link = empty.querySelector('a[href="/trips/new"]');
    expect(link).toBeTruthy();
  });

  it('state=error: load 錯誤顯示 role="alert"', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.reject(new Error('5xx'));
      return Promise.resolve([]);
    });
    renderPage();
    await waitFor(() => {
      const errs = document.querySelectorAll('[role="alert"]');
      expect(errs.length).toBeGreaterThan(0);
    });
  });

  it('state=conflict: server 409 + conflictWith 開 ConflictModal', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
      if (path === '/my-trips') return Promise.resolve([{ tripId: 't1', name: 'T1', totalDays: 3 }]);
      if (path.startsWith('/trips/t1/days')) return Promise.resolve([{ dayNum: 1, date: '2026-07-26', label: 'D1' }]);
      if (path.includes('/add-to-trip')) {
        return Promise.reject(
          new ApiError('CONFLICT_TIME_OVERLAP', 409, '衝突', {
            conflictWith: { entryId: 99, time: '12:00-13:00', title: '原餐廳', dayNum: 1 },
          }),
        );
      }
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 1/);
    pickTime('favorites-add-to-trip-start', '12:00');
    pickTime('favorites-add-to-trip-end', '13:00');
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
    await waitFor(() => {
      // ConflictModal 開（exclude TripSelect listbox dialog）
      const modal = document.querySelector(
        '[data-testid="conflict-modal"], [role="dialog"]:not([aria-labelledby])',
      );
      expect(modal).toBeTruthy();
    });
  });

  it('state=optimistic: submit 中 button 顯示「加入中…」+ disable 防重 click', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
      if (path === '/my-trips') return Promise.resolve([{ tripId: 't1', name: 'T1', totalDays: 3 }]);
      if (path.startsWith('/trips/t1/days')) return Promise.resolve([{ dayNum: 1, date: '2026-07-26', label: 'D1' }]);
      if (path.includes('/add-to-trip')) return new Promise(() => {}); // pending
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 1/);
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
    await waitFor(() => {
      const btn = screen.getByTestId('favorites-add-to-trip-submit') as HTMLButtonElement;
      expect(btn.textContent).toContain('加入中');
      expect(btn.disabled).toBe(true);
    });
  });
});

describe('AddPoiFavoriteToTripPage — summary tone (v2.54.2 三色)', () => {
  // 摘要框 bg/border 依加收藏 POI 類型上 tone；data-tone 必須跟著 favorite.poiType 走，
  // 不是寫死。用 empty-no-trip state（my-trips=[]）渲染，該 state 一定顯示摘要框。
  function renderWithFavoriteType(poiType: string) {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([{ ...SAMPLE_FAVORITE, poiType }]);
      if (path === '/my-trips') return Promise.resolve([]);
      return Promise.resolve({});
    });
    return renderPage();
  }

  it('吃（restaurant）→ 摘要框 data-tone="pink"', async () => {
    renderWithFavoriteType('restaurant');
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-empty')).toBeTruthy());
    const summary = document.querySelector('.tp-form-poi-summary');
    expect(summary?.getAttribute('data-tone')).toBe('pink');
  });

  it('住（hotel）→ 摘要框 data-tone="sage"（證明 tone 跟 poiType 走，非寫死）', async () => {
    renderWithFavoriteType('hotel');
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-empty')).toBeTruthy());
    const summary = document.querySelector('.tp-form-poi-summary');
    expect(summary?.getAttribute('data-tone')).toBe('sage');
  });

  // Direct mode（從 ExplorePage ➕ 進來）的 poiType 是 raw Google primaryType（如 lodging），
  // 非 canonical。摘要 tone 必須先 mapGooglePrimaryTypeToPoiType 正規化才上色，否則 lodging
  // 直接餵 poiTypeToTone 會落 neutral（warm），跟 ExplorePage 卡的 sage 不一致。
  it('direct mode：raw category「lodging」正規化後 → data-tone="sage"', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/my-trips') return Promise.resolve([]);
      return Promise.resolve({});
    });
    render(
      <MemoryRouter
        initialEntries={[
          '/add-to-trip?place_id=ChIJhotel&name=Hotel+X&lat=26.2&lng=127.6&category=lodging',
        ]}
      >
        <Routes>
          <Route path="/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-empty')).toBeTruthy());
    const summary = document.querySelector('.tp-form-poi-summary');
    expect(summary?.getAttribute('data-tone')).toBe('sage');
  });
});

describe('AddPoiFavoriteToTripPage — trip-day skeleton (§12.4)', () => {
  it('trip 切換時 day select 顯示 .tp-skel skeleton + submit disabled', async () => {
    let resolveDays: ((value: { days: unknown[] }) => void) | null = null;
    const daysPending = new Promise<{ days: unknown[] }>((res) => { resolveDays = res; });
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
      if (path === '/my-trips') return Promise.resolve([
        { tripId: 't1', name: 'T1', totalDays: 3 },
        { tripId: 't2', name: 'T2', totalDays: 5 },
      ]);
      if (path.startsWith('/trips/t1/days')) return Promise.resolve([{ dayNum: 1, date: '2026-07-26', label: 'D1' }]);
      if (path.startsWith('/trips/t2/days')) return daysPending; // pending
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    // 切到 t2 — days 載入中
    await pickFromTripSelect('favorites-add-to-trip-trip', /T2/);
    await waitFor(() => {
      // skeleton 出現
      expect(screen.getByTestId('favorites-add-to-trip-day-skeleton')).toBeTruthy();
      // submit disabled
      const btn = screen.getByTestId('favorites-add-to-trip-submit') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
    // resolve — skeleton 消失
    resolveDays!({ days: [{ dayNum: 1, date: '2026-08-01', label: 'A' }] });
    await waitFor(() => {
      expect(screen.queryByTestId('favorites-add-to-trip-day-skeleton')).toBeNull();
    });
  });
});
