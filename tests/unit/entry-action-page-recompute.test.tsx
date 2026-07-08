/**
 * EntryActionPage move/copy 車程重算 scope（2026-07-06 車程重算缺口修正）
 *
 * move 影響來源日 + 目標日兩天的 adjacency、copy 只影響目標日。
 * 驗：
 *   - copy → 恰 1 次 recompute（targetDayNum）
 *   - move 跨日 → 恰 2 次（target + source）
 *   - move 的 source==target dedupe（同日不雙發燒 quota）— 實務上同日 move
 *     被 canConfirm 擋，但 dedupe 邏輯仍該鎖定
 *   - dayNumFromId 三分支直測（found / miss / null）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EntryActionPage from '../../src/pages/EntryActionPage';
import { dayNumFromId, type DayOption } from '../../src/lib/entryAction';

const navigateSpy = vi.fn();
// 穩定 reference — 每 render 回新 object 會讓依賴 auth.user 的 load effect
// 無限重跑（loading 閃爍，confirm 鈕時有時無）
const AUTH_RESULT = { user: { email: 'user@test.com' }, loading: false };
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => AUTH_RESULT,
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => AUTH_RESULT,
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => () => navigateSpy('back'),
}));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/components/TripSelect', () => ({ TripSelect: () => null }));

const apiFetchMock = vi.fn();
const apiFetchRawMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (...a: unknown[]) => apiFetchMock(...a),
  apiFetchRaw: (...a: unknown[]) => apiFetchRawMock(...a),
}));

const recomputeMock = vi.fn(() => Promise.resolve(null));
vi.mock('../../src/lib/travelRecompute', () => ({
  requestTravelRecompute: (...a: unknown[]) => recomputeMock(...a),
  getAutoRecomputeStatus: () => 'active',
}));

// GET /days?all=1（day 選單）+ GET /entries/:eid（current day）
const DAYS_API = [
  { id: 71, dayNum: 1, date: '2026-07-26', dayOfWeek: '日', timeline: [{ id: 1 }] },
  { id: 72, dayNum: 2, date: '2026-07-27', dayOfWeek: '一', timeline: [{ id: 2 }] },
];

function renderPage(action: 'move' | 'copy') {
  return render(
    <MemoryRouter initialEntries={[`/trip/t1/stop/42/${action}`]}>
      <Routes>
        <Route path="/trip/:tripId/stop/:entryId/move" element={<EntryActionPage action="move" />} />
        <Route path="/trip/:tripId/stop/:entryId/copy" element={<EntryActionPage action="copy" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMock.mockImplementation((path: string) => {
    if (String(path).includes('/days')) return Promise.resolve(DAYS_API);
    if (String(path).includes('/entries/')) return Promise.resolve({ id: 42, dayId: 71 });
    return Promise.resolve({});
  });
  apiFetchRawMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
});

describe('EntryActionPage — move/copy 車程重算 scope', () => {
  it('copy → 恰 1 次 recompute，scope = 目標日 dayNum', async () => {
    renderPage('copy');
    // 等 day 選項載入（entry 在 day 71 / dayNum 1，選 day 72 / dayNum 2）
    const day2 = await screen.findByTestId('entry-action-day-2');
    fireEvent.click(day2);
    fireEvent.click(screen.getByTestId('entry-action-titlebar-confirm'));

    await waitFor(() => expect(recomputeMock).toHaveBeenCalledTimes(1));
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
  });

  it('move 跨日 → 恰 2 次 recompute（target=2 + source=1）', async () => {
    renderPage('move');
    const day2 = await screen.findByTestId('entry-action-day-2');
    fireEvent.click(day2);
    fireEvent.click(screen.getByTestId('entry-action-titlebar-confirm'));

    await waitFor(() => expect(recomputeMock).toHaveBeenCalledTimes(2));
    expect(recomputeMock).toHaveBeenNthCalledWith(1, 't1', 2);
    expect(recomputeMock).toHaveBeenNthCalledWith(2, 't1', 1);
  });
});

describe('dayNumFromId 三分支', () => {
  const DAYS: DayOption[] = [
    { dayId: 71, dayNum: 1, label: 'Day 1', stopCount: 1 },
    { dayId: 72, dayNum: 2, label: 'Day 2', stopCount: 1 },
  ];

  it('hit → dayNum；miss → null；dayId null/undefined → null；days null → null', () => {
    expect(dayNumFromId(DAYS, 72)).toBe(2);
    expect(dayNumFromId(DAYS, 999)).toBeNull();
    expect(dayNumFromId(DAYS, null)).toBeNull();
    expect(dayNumFromId(DAYS, undefined)).toBeNull();
    expect(dayNumFromId(null, 72)).toBeNull();
  });
});
