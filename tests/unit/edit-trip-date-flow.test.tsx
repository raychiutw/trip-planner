import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditTripPage from '../../src/pages/EditTripPage';

const apiFetchRaw = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
const user = vi.hoisted(() => ({ id: 'u1', email: 'owner@example.com' }));
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRaw(path, init) }));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user }) }));
vi.mock('../../src/components/shell/OperationShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const days = [
  { id: 1, dayNum: 1, date: '2026-04-01', dayOfWeek: '三', timeline: [{ id: 11 }] },
  { id: 2, dayNum: 2, date: '2026-04-02', dayOfWeek: '四', timeline: [{ id: 22 }] },
  { id: 3, dayNum: 3, date: '2026-04-03', dayOfWeek: '五', timeline: [] },
];

function mount() {
  return render(<MemoryRouter initialEntries={['/trip/t1/edit']}><Routes>
    <Route path="/trip/:tripId/edit" element={<EditTripPage />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  apiFetchRaw.mockReset();
  apiFetchRaw.mockImplementation(async (path) => {
    if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', description: '保留的描述', destinations: [], published: 1 });
    if (path === '/trips/t1/days?all=1') return json(days);
    return json({});
  });
  window.scrollTo = vi.fn();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});

describe('EditTripPage 日期變更', () => {
  it('出發日期對話框有完整名稱，Escape 關閉並返回觸發按鈕', async () => {
    mount();
    const trigger = await screen.findByTestId('edit-trip-day-shift-btn');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '變更出發日期' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(within(dialog).getByTestId('edit-trip-shift-preview')).toHaveTextContent('4/1');
    const cancel = within(dialog).getByRole('button', { name: '取消' });
    cancel.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '變更出發日期' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('edit-trip-shift-modal')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('日期預覽與提交反映實際平移，失敗時保留選擇與已填表單', async () => {
    let currentDays = days;
    let submissions = 0;
    apiFetchRaw.mockImplementation(async (path, init) => {
      if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', description: '保留的描述', destinations: [], published: 1 });
      if (path === '/trips/t1/days?all=1') return json(currentDays);
      if (path === '/trips/t1/days/shift' && init?.method === 'POST') {
        submissions++;
        if (submissions === 1) return json({ error: { message: '暫時無法變更' } }, 503);
        currentDays = days.map((day, index) => ({
          ...day, date: `2026-04-0${index + 3}`, dayOfWeek: ['五', '六', '日'][index],
        }));
        return json({ ok: true, daysShifted: 3 });
      }
      return json({});
    });
    mount();
    fireEvent.click(await screen.findByTestId('edit-trip-day-shift-btn'));
    const dialog = screen.getByRole('dialog', { name: '變更出發日期' });
    fireEvent.click(within(dialog).getByRole('button', { name: '變更出發日期' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Friday, April 3rd, 2026' }));
    expect(within(dialog).getByTestId('edit-trip-shift-preview')).toHaveTextContent('3 天日期將往後平移 2 天');
    expect(within(dialog).getByTestId('edit-trip-shift-preview')).toHaveTextContent('4/3');
    fireEvent.click(within(dialog).getByRole('button', { name: '確認變更' }));
    expect(await screen.findByText('暫時無法變更')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '變更出發日期' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '變更出發日期' })).toHaveTextContent('2026-04-03');
    expect(screen.getByTestId('edit-trip-desc-input')).toHaveValue('保留的描述');
    expect(screen.getByRole('radio', { name: '上線' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: '確認變更' }));
    await waitFor(() => expect(screen.queryByTestId('edit-trip-shift-modal')).not.toBeInTheDocument());
    expect(screen.getByTestId('edit-trip-day-row-1')).toHaveTextContent('4/3');
    expect(submissions).toBe(2);
  });

  it('刪天失敗保留確認與表單，重複送出只送一次', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<Response>((_, fail) => { reject = fail; });
    apiFetchRaw.mockImplementation(async (path, init) => {
      if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', description: '保留的描述', destinations: [], published: 1 });
      if (path === '/trips/t1/days?all=1') return json(days);
      if (init?.method === 'DELETE') return pending;
      return json({});
    });
    mount();
    fireEvent.click(await screen.findByTestId('edit-trip-day-remove-2'));
    const dialog = screen.getByRole('alertdialog', { name: '刪除 Day 2？' });
    expect(dialog).toHaveTextContent('1 個景點');
    expect(dialog).toHaveTextContent('後續天數的 Day 編號會往前遞補');
    const confirm = within(dialog).getByRole('button', { name: '刪除 Day 2' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(apiFetchRaw.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('confirm-modal-backdrop'));
    expect(screen.getByRole('alertdialog', { name: '刪除 Day 2？' })).toBeInTheDocument();
    await act(async () => reject(new Error('offline')));
    expect(screen.getByRole('alertdialog', { name: '刪除 Day 2？' })).toBeInTheDocument();
    expect(screen.getByTestId('edit-trip-day-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('edit-trip-desc-input')).toHaveValue('保留的描述');
    expect(screen.getByRole('radio', { name: '上線' })).toHaveAttribute('aria-checked', 'true');
  });

  it('空白天刪除前也說明後續 Day 編號與日期的影響', async () => {
    apiFetchRaw.mockImplementation(async (path) => {
      if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', destinations: [], published: 1 });
      if (path === '/trips/t1/days?all=1') return json(days.map((day) => day.dayNum === 2 ? { ...day, timeline: [] } : day));
      return json({});
    });
    mount();
    fireEvent.click(await screen.findByTestId('edit-trip-day-remove-2'));
    const dialog = screen.getByRole('alertdialog', { name: '刪除 Day 2？' });
    expect(dialog).toHaveTextContent('目前是空的');
    expect(dialog).toHaveTextContent('後續天數的 Day 編號會往前遞補');
  });

  it('刪除已成功但日期重讀失敗時不顯示舊清單或重送刪除，讀取恢復後顯示新日期', async () => {
    let reads = 0;
    let deletes = 0;
    apiFetchRaw.mockImplementation(async (path, init) => {
      if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', description: '保留的描述', destinations: [], published: 1 });
      if (path === '/trips/t1/days?all=1') {
        reads++;
        if (reads === 2) throw new Error('read offline');
        return json(reads >= 3 ? [days[0], { ...days[2], dayNum: 2 }] : days);
      }
      if (init?.method === 'DELETE') { deletes++; return json({ ok: true, removedEntryCount: 1 }); }
      return json({});
    });
    mount();
    fireEvent.click(await screen.findByTestId('edit-trip-day-remove-2'));
    fireEvent.click(within(screen.getByRole('alertdialog', { name: '刪除 Day 2？' })).getByRole('button', { name: '刪除 Day 2' }));
    const retry = await screen.findByRole('button', { name: '重新讀取行程日期' });
    expect(screen.queryByTestId('edit-trip-day-row-2')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: '刪除 Day 2？' })).not.toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('edit-trip-day-row-2')).toHaveTextContent('4/3'));
    expect(deletes).toBe(1);
  });
});
