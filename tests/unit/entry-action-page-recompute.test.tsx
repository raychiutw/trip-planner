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
import { pickFromTripSelect } from './__helpers__/tripSelect';
import { pickTime } from './__helpers__/tripTimePicker';

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
  it('自訂時段驗證起訖並寫入目標日', async () => {
    renderPage('move');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    await pickFromTripSelect('entry-action-timeslot', /自訂時段/);
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    expect(await screen.findByText(/請設定有效的自訂時段/)).toBeInTheDocument();
    expect(apiFetchRawMock).not.toHaveBeenCalled();
    pickTime('entry-action-custom-start', '14:00');
    pickTime('entry-action-custom-end', '16:30');
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toEqual({ day_id: 72, start_time: '14:00', end_time: '16:30' });
  });

  it('時段選擇實際寫入複製的目標 entry', async () => {
    renderPage('copy');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    await pickFromTripSelect('entry-action-timeslot', /午餐/);
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((apiFetchRawMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toEqual({ targetDayId: 72, time: '12:00 - 13:30' });
  });

  it('copy 可選目前日，move 仍須換日', async () => {
    const page = renderPage('copy');
    fireEvent.click(await screen.findByTestId('entry-action-day-1'));
    expect(screen.getByTestId('entry-action-confirm')).toBeEnabled();
    page.unmount();
    renderPage('move');
    fireEvent.click(await screen.findByTestId('entry-action-day-1'));
    expect(screen.getByTestId('entry-action-confirm')).toBeDisabled();
  });

  it('雙擊送出只建立一次', async () => {
    let resolveWrite!: (value: unknown) => void;
    apiFetchRawMock.mockReturnValueOnce(new Promise((resolve) => { resolveWrite = resolve; }));
    renderPage('copy');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    const confirm = screen.getByTestId('entry-action-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
    resolveWrite({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
  });

  it('409 保留選擇與錯誤，可重新提交', async () => {
    apiFetchRawMock.mockResolvedValueOnce({ ok: false, status: 409, text: () => Promise.resolve('{"error":{"message":"目標日期衝突"}}') });
    renderPage('move');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    expect(await screen.findByText('目標日期衝突')).toBeInTheDocument();
    expect(screen.getByTestId('entry-action-day-2')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('entry-action-confirm')).toBeEnabled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('日期載入失敗可重試', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('日期載入失敗'));
    renderPage('copy');
    expect(await screen.findByText('日期載入失敗')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重試載入'));
    expect(await screen.findByTestId('entry-action-day-2')).toBeInTheDocument();
  });

  it('寫入成功但目標日交通失敗時保留頁面，重試不重送 copy', async () => {
    recomputeMock.mockRejectedValueOnce(new Error('travel failed')).mockResolvedValue(null);
    renderPage('copy');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));

    expect(await screen.findByText(/交通更新失敗/)).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
    expect(recomputeMock).toHaveBeenCalledTimes(2);
  });

  it('copy → 恰 1 次 recompute，scope = 目標日 dayNum', async () => {
    renderPage('copy');
    // 等 day 選項載入（entry 在 day 71 / dayNum 1，選 day 72 / dayNum 2）
    const day2 = await screen.findByTestId('entry-action-day-2');
    fireEvent.click(day2);
    fireEvent.click(screen.getByTestId('entry-action-confirm'));

    await waitFor(() => expect(recomputeMock).toHaveBeenCalledTimes(1));
    expect(recomputeMock).toHaveBeenCalledWith('t1', 2);
  });

  it('move 跨日 → 恰 2 次 recompute（target=2 + source=1）', async () => {
    renderPage('move');
    const day2 = await screen.findByTestId('entry-action-day-2');
    fireEvent.click(day2);
    fireEvent.click(screen.getByTestId('entry-action-confirm'));

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
