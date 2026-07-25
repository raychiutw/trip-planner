import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';
import ChangePoiPage from '../../src/pages/ChangePoiPage';

/**
 * #1162 · 換景點操作面板切換來源分頁不得重設堆疊層級。
 *
 * 症狀（僅桌機）：從編輯景點頁 push 進「變更景點」面板時帶 `state.depth = 2`，
 * `OperationShell` 據此顯示「‹ 返回上一層」。按「收藏」或「自訂」分頁後，‹ 當場消失，
 * 使用者只剩 ✕（整個關閉），回不到編輯景點頁。
 *
 * 根因不在我方 code 的顯而易見處，而在 react-router 的 setter 語意：
 * `useSearchParams` 的 setter 只做 `navigate('?' + params, opts)`，而 router 內部
 * `createLocation(current, path, opts?.state, ...)` 的 state **只取 `opts.state`、
 * 不與現有 location.state 合併**。所以 `setSearchParams(next, { replace: true })`
 * 產生的新 location 其 `state === null` → `depth` 落回預設 1 → `showBack` 轉 false。
 * 同一路由不會 unmount，`useLocation()` re-render，所以是「按下去當場不見」。
 *
 * ⚠ **這支刻意不寫進既有的 tests/unit/change-poi-page.test.tsx。** 那支在頂層
 * `vi.mock('react-router-dom')`，而 `useSearchParams` 的 setter 內部就是呼叫
 * `useNavigate()` —— 在那支檔案裡 URL 與 location.state 根本不會變動，任何關於本 bug
 * 的斷言都會**假綠**。本檔保留真的 react-router，只 mock 資料層與 shell。
 */

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'a@b.c', displayName: 'Ray' }, loading: false }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));
vi.mock('../../src/hooks/usePoiSearch', () => ({
  usePoiSearch: () => ({
    query: '', setQuery: vi.fn(), results: [], loading: false, error: null,
    search: vi.fn(), reset: vi.fn(), hasSearched: false,
  }),
}));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <div>{main}</div>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/lib/apiClient', () => ({
  // 收藏分頁會做 `(favorites ?? []).filter(...)` —— 回 {} 會丟 TypeError 變成 unhandled
  // error 的雜訊，可能蓋掉真正的斷言失敗。一律回空陣列。
  apiFetch: vi.fn(async () => []),
  apiFetchRaw: vi.fn(async () => new Response('[]', { status: 200 })),
}));

const ROUTE = '/trip/t1/stop/42/change-poi';

/**
 * 用真 MemoryRouter 掛在真實的 route pattern 上（`useParams` 要拿到 tripId/entryId），
 * 並用 SheetStackProvider 注入 `inStack`（真實情境由 `useMediaQuery('(min-width:1024px)')`
 * 決定；這裡直接注入才不必在 jsdom 假造 viewport）。
 */
function renderPanel({ depth, inStack = true }: { depth?: number; inStack?: boolean }) {
  return render(
    <MemoryRouter
      initialEntries={[{
        pathname: ROUTE,
        search: '?mode=alternate&tab=search',
        state: depth === undefined ? null : { opStacked: true, depth },
      }]}
    >
      <SheetStackProvider value={{ inStack, closeStack: vi.fn() }}>
        <Routes>
          <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangePoiPage />} />
        </Routes>
      </SheetStackProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe('#1162 — 切換來源分頁不得抹掉 state.depth', () => {
  it('depth=2 進來 → 切到「收藏」分頁後，「返回上一層」仍在（且分頁真的切了）', async () => {
    renderPanel({ depth: 2 });

    // 前置：桌機 depth>1 → ‹ 應該在。這條同時證明 harness 有效（provider/route/state 都對）。
    await waitFor(() =>
      expect(screen.getByTestId('stack-panel-back'), 'harness 壞了：depth=2 時 ‹ 本來就該在').toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('change-poi-tab-favorites'));

    // 先驗分頁真的切了 —— 少了這條，一個什麼都不做的 handleTabChange 也能讓下面那條通過。
    await waitFor(() =>
      expect(
        screen.getByTestId('change-poi-tab-favorites').getAttribute('aria-selected'),
        '分頁沒有真的切換 —— 後面的「‹ 還在」就什麼都沒驗到',
      ).toBe('true'),
    );

    // 核心斷言：#1162 要修的就是這裡。修前 location.state 被 setSearchParams 抹成 null，
    // depth 落回 1，OperationShell 的 showBack 轉 false，這顆按鈕整個從 DOM 消失。
    expect(
      screen.queryByTestId('stack-panel-back'),
      '切分頁後「返回上一層」消失了 —— 使用者只剩 ✕，回不到編輯景點頁',
    ).toBeInTheDocument();
  });

  it('反向控制：depth 未帶（第一層）+ 桌機 → 本來就不該有「返回上一層」', async () => {
    // 少了這條，把 showBack 改成恆真也能讓上面那支變綠。
    renderPanel({ depth: undefined });
    await waitFor(() => expect(screen.getByTestId('change-poi-tab-search')).toBeInTheDocument());
    expect(
      screen.queryByTestId('stack-panel-back'),
      '第一層不該有 ‹（depth≤1 時 OperationShell 只給 ✕）',
    ).not.toBeInTheDocument();
  });

  it('切到「自訂」分頁同樣保住 depth（三顆分頁鈕走同一條路徑，不只修其中一顆）', async () => {
    renderPanel({ depth: 2 });
    await waitFor(() => expect(screen.getByTestId('stack-panel-back')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('change-poi-tab-custom'));
    await waitFor(() =>
      expect(screen.getByTestId('change-poi-tab-custom').getAttribute('aria-selected')).toBe('true'),
    );
    expect(screen.queryByTestId('stack-panel-back')).toBeInTheDocument();
  });
});
