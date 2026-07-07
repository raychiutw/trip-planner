/**
 * AddPoiFavoriteToTripPage form fields + actions test (§12.3 + §12.6 + §12.10)
 *
 * 對齊 mockup B1/B2 + DESIGN.md L584-590（4-field 純時間驅動）：
 *   - 4 fields: trip / day / startTime / endTime
 *   - SHALL NOT 含 position radio / anchorEntryId input
 *   - 「加入行程」primary button 在 .tp-form-actions wrapper，置中放 form 下方（不在 TitleBar 右）
 *   - 提交 API body 4 fields: { tripId, dayNum, startTime, endTime }
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

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => () => {},
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';

const SAMPLE_FAVORITE = {
  id: 5,
  poiId: 100,
  poiName: 'MARUMARO 北谷店',
  poiAddress: '沖縄県中頭郡北谷町',
  poiType: 'restaurant',
  favoritedAt: '2026-04-01T00:00:00Z',
  note: null,
};

const SAMPLE_TRIPS = [
  { tripId: 't1', name: '沖繩 7 日', totalDays: 7 },
  { tripId: 't2', name: '京都 3 日', totalDays: 3 },
];

const SAMPLE_DAYS = [
  { dayNum: 1, date: '2026-07-26', label: '抵達' },
  { dayNum: 2, date: '2026-07-27', label: '北部' },
];

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
  navigateMock.mockReset();
  apiFetchMock.mockImplementation((path) => {
    if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
    if (path === '/my-trips') return Promise.resolve(SAMPLE_TRIPS);
    if (path.startsWith('/trips/t1/days')) return Promise.resolve(SAMPLE_DAYS);
    if (path.startsWith('/trips/t2/days')) return Promise.resolve([]);
    if (path.includes('/add-to-trip')) return Promise.resolve({});
    return Promise.resolve({});
  });
});

describe('AddPoiFavoriteToTripPage — form fields (4 純時間驅動)', () => {
  it('render 4 fields: trip / day / startTime / endTime', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy();
    expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy();
    expect(screen.getByTestId('favorites-add-to-trip-start')).toBeTruthy();
    expect(screen.getByTestId('favorites-add-to-trip-end')).toBeTruthy();
  });

  it('SHALL NOT render position select (廢除)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    expect(screen.queryByTestId('favorites-add-to-trip-position')).toBeNull();
  });

  it('SHALL NOT render anchorEntryId input (廢除)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    expect(screen.queryByTestId('favorites-add-to-trip-anchor')).toBeNull();
  });

  it('提交 API body 為 4 fields { tripId, dayNum, startTime, endTime }', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /沖繩 7 日/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 2/);
    pickTime('favorites-add-to-trip-start', '12:00');
    pickTime('favorites-add-to-trip-end', '13:30');

    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));

    await waitFor(() => {
      const calls = apiFetchMock.mock.calls;
      const submitCall = calls.find(([path]) => typeof path === 'string' && path.includes('/add-to-trip'));
      expect(submitCall).toBeTruthy();
      const body = JSON.parse((submitCall![1] as RequestInit).body as string);
      expect(body.tripId).toBe('t1');
      expect(body.dayNum).toBe(2);
      expect(body.startTime).toBe('12:00');
      expect(body.endTime).toBe('13:30');
      // 4 fields only — body 不該含 position 或 anchorEntryId
      expect(body).not.toHaveProperty('position');
      expect(body).not.toHaveProperty('anchorEntryId');
    });
  });

  it('API 路徑 /poi-favorites/:id/add-to-trip (修正過去 /favorites/:id 的 drift)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /沖繩 7 日/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 1/);
    pickTime('favorites-add-to-trip-start', '10:00');
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
    await waitFor(() => {
      const calls = apiFetchMock.mock.calls;
      const submitCall = calls.find(([path]) => typeof path === 'string' && path.includes('/add-to-trip'));
      expect(submitCall![0]).toBe('/poi-favorites/5/add-to-trip');
    });
  });
});

describe('AddPoiFavoriteToTripPage — primary button placement (mockup B1)', () => {
  it('「加入行程」primary button 在 .tp-form-actions wrapper (form 下方置中，不在 TitleBar)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeTruthy());
    const submitBtn = screen.getByTestId('favorites-add-to-trip-submit');
    // 必須 wrapped in .tp-form-actions
    const wrapper = submitBtn.closest('.tp-form-actions');
    expect(wrapper).toBeTruthy();
    // SHALL NOT 在舊的 .tp-page-bottom-bar
    expect(submitBtn.closest('.tp-page-bottom-bar')).toBeNull();
  });

  it('TitleBar 右側 SHALL NOT 含 confirm action (left back only)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-submit')).toBeTruthy());
    const titlebar = document.querySelector('[data-testid="page-titlebar"], .tp-titlebar');
    if (titlebar) {
      expect(titlebar.querySelector('.tp-titlebar-action.is-primary')).toBeNull();
      // 也不該含 submit testid
      expect(titlebar.querySelector('[data-testid="favorites-add-to-trip-submit"]')).toBeNull();
    }
  });
});

// Direct mode（v2.23.8 Plan B）— /add-to-trip?place_id=X&name=Y&lat=Z&lng=W
// 從 ExplorePage ➕ 進來，沒對應 favorite，POST 走 /api/trips/:id/days/:num/entries。
// 後端只認 body.time（"HH:MM-HH:MM"），前端必須 join；曾經誤送 startTime/endTime
// 兩欄位 → 後端 ignore → time 存 null（user 看到的「沒有起訖時間」即此 bug）。
describe('AddPoiFavoriteToTripPage — direct mode（無 favoriteId）', () => {
  function renderDirect() {
    return render(
      <MemoryRouter
        initialEntries={[
          '/add-to-trip?place_id=ChIJtest&name=Uniqlo+Ginza&lat=35.67&lng=139.76&address=Ginza+6&category=shopping',
        ]}
      >
        <Routes>
          <Route path="/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('POST entries body 含 time="HH:MM-HH:MM"，不再送 startTime/endTime 欄位', async () => {
    renderDirect();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /沖繩 7 日/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 1/);
    pickTime('favorites-add-to-trip-start', '14:00');
    pickTime('favorites-add-to-trip-end', '15:30');

    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));

    await waitFor(() => {
      const calls = apiFetchMock.mock.calls;
      const submitCall = calls.find(
        ([path]) => typeof path === 'string' && path.includes('/days/') && path.endsWith('/entries'),
      );
      expect(submitCall).toBeTruthy();
      const body = JSON.parse((submitCall![1] as RequestInit).body as string);
      expect(body.time).toBe('14:00-15:30');
      expect(body).not.toHaveProperty('startTime');
      expect(body).not.toHaveProperty('endTime');
      expect(body.name).toBe('Uniqlo Ginza');
      expect(body).not.toHaveProperty('title');
      expect(body.source).toBe('google');
    });
  });

  it('startTime/endTime 都空 → time omitted（不送破爛字串）', async () => {
    renderDirect();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /沖繩 7 日/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-day', /Day 1/);
    // 不填 start/end
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));

    await waitFor(() => {
      const calls = apiFetchMock.mock.calls;
      const submitCall = calls.find(
        ([path]) => typeof path === 'string' && path.includes('/days/') && path.endsWith('/entries'),
      );
      expect(submitCall).toBeTruthy();
      const body = JSON.parse((submitCall![1] as RequestInit).body as string);
      expect(body.time).toBeUndefined();
    });
  });
});
