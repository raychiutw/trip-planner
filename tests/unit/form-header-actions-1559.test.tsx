/**
 * #1559 表單頁主要動作全部放標題列。
 *
 * owner 簽核 5 點：
 *   1 手機也顯示文字 label（不 icon-only）
 *   2 取消「取消」鈕：返回即取消
 *   3 EditTripPage：右側「完成」、摘要列「已自動儲存」、發布狀態搬到內容區頂端卡片
 *   4 StackPanelHeader 新增右側 primary action slot；.tp-page-bottom-bar 對表單頁退役
 *   5 錯誤：標題列正下方 role="alert" 橫幅，主要動作恢復可點；送出中 busy + spinner + disabled，返回也停用
 *
 * 五頁（NewTrip / AddStop / ChangePoi / EntryAction / EditTrip）逐頁驗證：
 *   - 主要動作在標題列內、沒有 .tp-page-bottom-bar、沒有取消鈕
 *   - 錯誤橫幅緊貼標題列（中間只允許摘要列）
 *   - 送出中 busy / disabled，返回鈕停用；失敗後動作恢復可點
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AddStopPage from '../../src/pages/AddStopPage';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import EntryActionPage from '../../src/pages/EntryActionPage';
import EditTripPage from '../../src/pages/EditTripPage';
import NewTripPage from '../../src/pages/NewTripPage';
import StackPanelHeader from '../../src/components/shell/StackPanelHeader';
import TitleBarPrimaryAction from '../../src/components/shell/TitleBarPrimaryAction';
import { resetToasts } from '../../src/lib/toastBus';

const { apiFetch, apiFetchRaw } = vi.hoisted(() => ({
  apiFetch: vi.fn<(path: string) => Promise<unknown>>(),
  apiFetchRaw: vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
}));
const AUTH = vi.hoisted(() => ({ user: { id: 'u1', email: 'test@example.com' }, loading: false }));
vi.mock('../../src/lib/apiClient', () => ({ apiFetch, apiFetchRaw }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => AUTH }));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => AUTH }));
vi.mock('../../src/hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const searchRow = { place_id: 'place-1', name: '東京塔', lat: 35.65, lng: 139.75, category: 'attraction' };

/** 標題列：OperationShell 的 StackPanelHeader 或 TitleBar。 */
const headerOf = () =>
  (screen.queryByTestId('stack-panel-header') ?? screen.getByTestId('titlebar')) as HTMLElement;

/** 錯誤橫幅必須緊貼標題列：中間最多只隔一條摘要列。 */
function expectAlertRightBelowHeader(message: RegExp | string) {
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent(message);
  let prev = alert.previousElementSibling as HTMLElement | null;
  if (prev?.classList.contains('tp-form-summary')) prev = prev.previousElementSibling as HTMLElement | null;
  expect(prev).toBe(headerOf());
}

function expectNoBottomBar() {
  expect(document.querySelector('.tp-page-bottom-bar')).toBeNull();
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trip/:tripId/add-stop" element={<AddStopPage />} />
        <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangePoiPage />} />
        <Route path="/trip/:tripId/stop/:entryId/copy" element={<EntryActionPage action="copy" />} />
        <Route path="/trip/:tripId/edit" element={<EditTripPage />} />
        <Route path="/trips/new" element={<NewTripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetToasts();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  apiFetch.mockImplementation(async (path) => {
    if (String(path).endsWith('/days')) return [{ id: 1, dayNum: 1 }];
    if (String(path).includes('/days?all=1')) return [{ id: 71, dayNum: 1, date: '2026-07-26', dayOfWeek: '日', timeline: [] }, { id: 72, dayNum: 2, date: '2026-07-27', dayOfWeek: '一', timeline: [] }];
    if (String(path).includes('/entries/')) return { id: 42, dayId: 71 };
    return [];
  });
  apiFetchRaw.mockImplementation(async (path) => {
    if (path.startsWith('/poi-search')) return json({ results: [searchRow] });
    if (path === '/trips/t1') return json({ id: 't1', title: '東京旅行', description: '', destinations: [], published: 1 });
    if (path.startsWith('/trips/t1/days')) return json([{ id: 1, dayNum: 1, date: '2026-04-01', dayOfWeek: '三', timeline: [] }]);
    return json({ id: 11 }, 201);
  });
});

describe('StackPanelHeader primary action slot（owner 點 4）', () => {
  it('primaryAction 渲染在右側、在 ✕ 之前', () => {
    render(<StackPanelHeader title="標題" onClose={() => {}} primaryAction={<button type="button">完成</button>} />);
    const head = screen.getByTestId('stack-panel-header');
    const done = within(head).getByRole('button', { name: '完成' });
    const close = within(head).getByTestId('stack-panel-close');
    expect(done.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('busy：返回與 ✕ 都停用（owner 點 5）', () => {
    render(<StackPanelHeader title="標題" onBack={() => {}} onClose={() => {}} busy primaryAction={<button type="button">建立</button>} />);
    expect(screen.getByTestId('stack-panel-back')).toBeDisabled();
    expect(screen.getByTestId('stack-panel-close')).toBeDisabled();
  });
});

describe('TitleBarPrimaryAction（owner 點 1、5）', () => {
  it('手機也顯示文字：帶 labeled 修飾 class，CSS 在 ≤760px 之後把 label 還原為 inline', () => {
    render(<TitleBarPrimaryAction label="建立" onClick={() => {}} testId="x" />);
    const btn = screen.getByTestId('x');
    expect(btn.className).toContain('tp-titlebar-action--labeled');
    expect(btn).toHaveAccessibleName('建立');
    const css = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');
    const mediaIdx = css.indexOf('@media (max-width: 760px)', css.indexOf('.tp-titlebar-action {'));
    const ruleIdx = css.indexOf('.tp-titlebar-action--labeled .tp-titlebar-action-label');
    expect(ruleIdx).toBeGreaterThan(mediaIdx);
    expect(css.slice(ruleIdx, ruleIdx + 120)).toMatch(/display:\s*inline/);
  });

  it('busy：換 busy label、spinner、aria-busy、disabled', () => {
    render(<TitleBarPrimaryAction label="建立" busyLabel="建立中⋯" busy onClick={() => {}} testId="x" />);
    const btn = screen.getByTestId('x');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveTextContent('建立中⋯');
    expect(btn.querySelector('.tp-titlebar-action-spinner')).not.toBeNull();
  });
});

describe('AddStopPage', () => {
  it('完成在標題列、無底部列、無取消鈕、計數在摘要列', async () => {
    mount('/trip/t1/add-stop?day=1');
    const head = headerOf();
    const confirm = within(head).getByTestId('add-stop-confirm');
    expect(confirm).toHaveTextContent('完成');
    expectNoBottomBar();
    expect(screen.queryByTestId('add-stop-cancel')).toBeNull();
    expect(screen.getByTestId('add-stop-counter').closest('.tp-form-summary')).not.toBeNull();
  });

  it('送出失敗：role=alert 橫幅緊貼標題列，完成恢復可點可重試', async () => {
    mount('/trip/t1/add-stop?day=1');
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('add-stop-search-card-place-1'));
    apiFetchRaw.mockImplementation(async (path) => (path.startsWith('/poi-search') ? json({ results: [searchRow] }) : json({ error: { message: '網路異常' } }, 500)));
    const confirm = within(headerOf()).getByTestId('add-stop-confirm');
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expectAlertRightBelowHeader(/./);
    expect(within(headerOf()).getByTestId('add-stop-confirm')).toBeEnabled();
  });

  it('送出中：busy label、disabled、aria-busy，返回鈕停用', async () => {
    mount('/trip/t1/add-stop?day=1');
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('add-stop-search-card-place-1'));
    apiFetchRaw.mockImplementation(() => new Promise<Response>(() => {}));
    fireEvent.click(within(headerOf()).getByTestId('add-stop-confirm'));
    const confirm = await waitFor(() => {
      const el = within(headerOf()).getByTestId('add-stop-confirm');
      expect(el).toBeDisabled();
      return el;
    });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm).toHaveTextContent('加入中⋯');
    expect(screen.getByTestId('stack-panel-back') ?? screen.getByTestId('stack-panel-close')).toBeDisabled();
  });
});

describe('ChangePoiPage', () => {
  it('確認在標題列、無底部列、無取消鈕、摘要列有已選計數', async () => {
    mount('/trip/t1/stop/42/change-poi?mode=master');
    const submit = within(headerOf()).getByTestId('change-poi-submit');
    expect(submit).toHaveTextContent('置換景點');
    expectNoBottomBar();
    expect(screen.queryByTestId('change-poi-cancel')).toBeNull();
    expect(screen.getByTestId('change-poi-counter').closest('.tp-form-summary')).not.toBeNull();
  });

  it('mode=new 的分類 chip 在「已選景點」卡片下的欄位列，不再 dropUp、不在標題列', async () => {
    mount('/trip/t1/stop/42/change-poi?mode=new&day=1');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    const card = await screen.findByTestId('change-poi-selected-card');
    expect(card).toHaveTextContent('已選景點');
    const field = screen.getByTestId('change-poi-category-field');
    expect(card.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headerOf().contains(field)).toBe(false);
    fireEvent.click(within(field).getByTestId('change-poi-cat-toggle'));
    expect(within(field).getByTestId('change-poi-cat-pop').className).not.toContain('is-up');
  });

  it('送出失敗：role=alert 橫幅緊貼標題列、確認恢復可點', async () => {
    mount('/trip/t1/stop/42/change-poi?mode=master');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    apiFetchRaw.mockImplementation(async (path) => (path.startsWith('/poi-search') ? json({ results: [searchRow] }) : json({ error: { message: '置換失敗' } }, 500)));
    fireEvent.click(within(headerOf()).getByTestId('change-poi-submit'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expectAlertRightBelowHeader(/./);
    expect(within(headerOf()).getByTestId('change-poi-submit')).toBeEnabled();
  });
});

describe('EntryActionPage', () => {
  it('確認在標題列、無底部列、無取消鈕', async () => {
    mount('/trip/t1/stop/42/copy');
    const confirm = await waitFor(() => within(headerOf()).getByTestId('entry-action-confirm'));
    expect(confirm).toHaveTextContent('複製');
    expectNoBottomBar();
    expect(screen.queryByTestId('entry-action-cancel')).toBeNull();
  });

  it('送出失敗：role=alert 橫幅緊貼標題列（不再埋在清單後面）、確認恢復可點', async () => {
    mount('/trip/t1/stop/42/copy');
    await screen.findByTestId('entry-action-day-2');
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    apiFetchRaw.mockResolvedValue(json({ error: { message: '複製失敗' } }, 500));
    fireEvent.click(within(headerOf()).getByTestId('entry-action-confirm'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expectAlertRightBelowHeader(/./);
    expect(within(headerOf()).getByTestId('entry-action-confirm')).toBeEnabled();
  });
});

describe('EditTripPage（auto-save，owner 點 3）', () => {
  it('右側「完成」在標題列、摘要列顯示「已自動儲存」、發布狀態在內容區頂端卡片、無底部列', async () => {
    mount('/trip/t1/edit');
    const done = await waitFor(() => within(headerOf()).getByTestId('edit-trip-done'));
    expect(done).toHaveTextContent('完成');
    expectNoBottomBar();
    expect(screen.queryByTestId('edit-trip-back')).toBeNull();
    expect(document.querySelector('.tp-form-summary')).toHaveTextContent('已自動儲存');
    const card = screen.getByTestId('edit-trip-publish-card');
    expect(headerOf().contains(card)).toBe(false);
    expect(within(card).getByRole('radiogroup', { name: '發布狀態' })).toBeInTheDocument();
    // 卡片是表單內第一個區塊
    expect(card.nextElementSibling?.tagName === 'P' || card.parentElement?.firstElementChild === card).toBe(true);
  });
});

describe('NewTripPage', () => {
  it('建立在標題列（手機也有文字）、無底部列、無取消鈕、摘要在摘要列、尚未選目的地停用', () => {
    mount('/trips/new');
    const submit = within(headerOf()).getByTestId('new-trip-submit');
    expect(submit).toHaveTextContent('建立');
    expect(submit).toBeDisabled();
    expectNoBottomBar();
    expect(screen.queryByTestId('new-trip-cancel')).toBeNull();
    expect(document.querySelector('.tp-form-summary')).toHaveTextContent('請先選擇目的地');
  });
});
