/**
 * TripStackLayout — rev2 桌機右欄操作堆疊 host 的分支 + 導航契約。
 *
 * 桌機（useMediaQuery=true）→ 3 欄 shell（sidebar｜中欄（TitleBar + portal placeholder）｜
 *   右欄 Outlet），context inStack=true、closeStack → /trips?selected=:id。
 * 手機（false）→ passthrough bare <Outlet>（無第二個 shell / 無中欄詳情、inStack 預設 false）。
 * invalid :tripId → 中欄不掛 placeholder（main=null）、closeStack fallback /trips。
 *
 * v2.57.x 第三輪（owner 回報 #2「開關第三欄面板會刷新第二欄」修復）：TripStackLayout
 * 不再 inline render <TripPage> —— 改留一個 portal placeholder（TRIP_MAIN_PORTAL_ID），
 * main.tsx 的 TripPageHost（唯一持續存在的 <TripPage> 實例）才是實際掛載處。這裡只驗證
 * TripStackLayout 有留下正確的 placeholder，<TripPage> 本身的行為見
 * tests/unit/trip-page-host.test.tsx。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import TripStackLayout from '../../src/pages/TripStackLayout';
import { useSheetStack } from '../../src/contexts/SheetStackContext';
import { TripContext } from '../../src/contexts/TripContext';
import { TripPageHandleContext } from '../../src/contexts/TripPageHandleContext';
import { TRIP_MAIN_PORTAL_ID } from '../../src/lib/tripStackRoutes';
import type { UseTripReturn } from '../../src/hooks/useTrip';
import type { Trip } from '../../src/types/trip';
import type { TripPageHandle } from '../../src/pages/TripPage';

let mockIsDesktop = true;
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockIsDesktop,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({
  default: () => <div data-testid="mock-sidebar" />,
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { userId: 'u1', email: 'ray@example.com' } }),
}));

// TripActionsMenu 的列印/下載透過 TripPageHandleContext 拿 ref（TripPageHost 持有的
// 那一份）—— 這裡給一個 stub handle 讓 tripPageRef.current 有東西可呼叫。
const mockTogglePrint = vi.fn();
const mockTriggerDownload = vi.fn();
const mockTripPageHandleRef = {
  current: {
    openSheet: vi.fn(),
    triggerDownload: mockTriggerDownload,
    togglePrint: mockTogglePrint,
    openAddStop: vi.fn(),
  } satisfies TripPageHandle,
};

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="loc">{pathname}{search}</div>;
}

/** 消費 SheetStack 的操作 stub — 點 ✕ 觸發 closeStack。 */
function OperationStub() {
  const { inStack, closeStack } = useSheetStack();
  return (
    <button data-testid="op-stub" data-in-stack={String(inStack)} onClick={closeStack}>
      op
    </button>
  );
}

/** v2.57.x：中欄 header 回歸測試用 — 最小 UseTripReturn fixture。 */
function makeTripCtx(trip: Partial<Trip> | null): UseTripReturn {
  return {
    trip: trip as Trip | null,
    days: [],
    currentDay: null,
    currentDayNum: 1,
    switchDay: () => {},
    refetchCurrentDay: () => {},
    refetchDay: () => {},
    docs: {},
    allDays: {},
    loading: trip === null,
    error: null,
  };
}

function renderAt(path: string, desktop: boolean, tripCtx: UseTripReturn | null = null) {
  mockIsDesktop = desktop;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <TripPageHandleContext.Provider value={mockTripPageHandleRef}>
        <TripContext.Provider value={tripCtx}>
          <Routes>
            <Route path="/trips" element={<div data-testid="trips-page">trips</div>} />
            <Route path="/trip/:tripId" element={<TripStackLayout />}>
              <Route path="add-stop" element={<OperationStub />} />
              <Route path="stop/:entryId/change-poi" element={<OperationStub />} />
            </Route>
          </Routes>
        </TripContext.Provider>
      </TripPageHandleContext.Provider>
    </MemoryRouter>,
  );
}

describe('TripStackLayout — 桌機/手機分支 + 導航', () => {
  beforeEach(() => {
    mockIsDesktop = true;
  });

  it('桌機：render 3 欄 host（sidebar｜中欄 TitleBar+portal placeholder｜右欄 Outlet 操作），inStack=true', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('app-shell').getAttribute('data-layout')).toBe('3pane');
    expect(getByTestId('mock-sidebar')).toBeTruthy();
    // 中欄不再 inline render TripPage —— 只留 portal placeholder，TripPageHost portal 進來。
    expect(getByTestId(TRIP_MAIN_PORTAL_ID)).toBeTruthy();
    const op = getByTestId('op-stub');
    expect(op).toBeTruthy();
    expect(op.getAttribute('data-in-stack')).toBe('true');
  });

  it('手機：passthrough bare Outlet — 無 app-shell、無中欄 placeholder，inStack 預設 false', () => {
    const { getByTestId, queryByTestId } = renderAt('/trip/t1/add-stop', false);
    expect(queryByTestId('app-shell')).toBeNull();
    expect(queryByTestId(TRIP_MAIN_PORTAL_ID)).toBeNull();
    const op = getByTestId('op-stub');
    expect(op).toBeTruthy();
    expect(op.getAttribute('data-in-stack')).toBe('false');
  });

  it('桌機：✕ closeStack → 導回 /trips?selected=:id', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true);
    fireEvent.click(getByTestId('op-stub'));
    expect(getByTestId('loc').textContent).toBe('/trips?selected=t1');
    expect(getByTestId('trips-page')).toBeTruthy();
  });

  it('桌機：巢狀操作路由（change-poi）解析正確、param 繼承（deep-link 不破）', () => {
    const { getByTestId } = renderAt('/trip/t1/stop/42/change-poi', true);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('op-stub').getAttribute('data-in-stack')).toBe('true');
    expect(getByTestId(TRIP_MAIN_PORTAL_ID)).toBeTruthy();
  });

  it('invalid :tripId → 中欄不掛 placeholder（main=null）、closeStack fallback /trips', () => {
    const { getByTestId, queryByTestId } = renderAt('/trip/bad!id/add-stop', true);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(queryByTestId(TRIP_MAIN_PORTAL_ID)).toBeNull();
    fireEvent.click(getByTestId('op-stub'));
    expect(getByTestId('loc').textContent).toBe('/trips');
  });

  // v2.57.x：owner 2026-07-21「開啟第三欄時第二欄 header 不要消失」——
  // 2026-07-19 決策的「中欄無 titlebar」在此補回一個輕量 TitleBar（行程名稱 + 返回列表），
  // 讓開右欄面板（含新遷入的共編/健檢/筆記）時中欄不會變成無頭內容。
  it('桌機：中欄補回 TitleBar，顯示 TripContext 的行程名稱', () => {
    const { getByTestId } = renderAt(
      '/trip/t1/add-stop',
      true,
      makeTripCtx({ id: 't1', name: 't1', title: '2026 沖繩七日遊' }),
    );
    const titlebar = getByTestId('titlebar');
    expect(titlebar).toBeTruthy();
    expect(titlebar.textContent).toContain('2026 沖繩七日遊');
  });

  it('桌機：TripContext 載入中（trip=null）→ 中欄 TitleBar 顯示「載入中…」佔位', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, makeTripCtx(null));
    expect(getByTestId('titlebar').textContent).toContain('載入中');
  });

  it('桌機：中欄 TitleBar 返回 → 與 ✕ 整個關閉同語意（導回 /trips?selected=:id）', () => {
    const { getByTestId } = renderAt(
      '/trip/t1/add-stop',
      true,
      makeTripCtx({ id: 't1', name: 't1', title: '2026 沖繩七日遊' }),
    );
    fireEvent.click(getByTestId('titlebar').querySelector('button')!);
    expect(getByTestId('loc').textContent).toBe('/trips?selected=t1');
    expect(getByTestId('trips-page')).toBeTruthy();
  });

  it('手機：passthrough bare Outlet 不受影響，無中欄 TitleBar', () => {
    const { queryByTestId } = renderAt(
      '/trip/t1/add-stop',
      false,
      makeTripCtx({ id: 't1', name: 't1', title: '2026 沖繩七日遊' }),
    );
    expect(queryByTestId('titlebar')).toBeNull();
  });
});

// owner 2026-07-21（第二輪回報 #1，最嚴重）：開了第三欄面板後，中欄 TitleBar 只有
// 標題 + 返回，操作入口（新增景點/共編/健檢/筆記/列印/下載/分享/編輯行程）全部消失。
// 中欄 TitleBar 補回 TripActionsMenu（與 TripsListPage embedded 詳情共用同一元件）。
describe('TripStackLayout — 中欄 TitleBar actions（owner 回報 #1：第三欄開啟後操作入口消失）', () => {
  beforeEach(() => {
    mockIsDesktop = true;
    mockTogglePrint.mockClear();
    mockTriggerDownload.mockClear();
  });

  const tripCtx = () => makeTripCtx({ id: 't1', name: 't1', title: '2026 沖繩七日遊' });

  it('桌機：中欄 TitleBar 顯示「新增景點」+「⋯」動作選單 trigger', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    expect(getByTestId('trip-add-stop-trigger')).toBeTruthy();
    expect(getByTestId('trips-embedded-menu-trigger')).toBeTruthy();
  });

  it('「新增景點」→ navigate 到 /trip/:id/add-entry（不離開 stack，中欄不重掛載）', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trip-add-stop-trigger'));
    expect(getByTestId('loc').textContent).toBe('/trip/t1/add-entry');
  });

  it('⋯ 選單「編輯行程」→ navigate 到 /trip/:id/edit', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trips-embedded-menu-trigger'));
    fireEvent.click(getByTestId('trip-embedded-menu-edit-t1'));
    expect(getByTestId('loc').textContent).toBe('/trip/t1/edit');
  });

  it('⋯ 選單「AI 健檢」→ navigate 到 /trip/:id/health', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trips-embedded-menu-trigger'));
    fireEvent.click(getByTestId('trip-embedded-menu-health-t1'));
    expect(getByTestId('loc').textContent).toBe('/trip/t1/health');
  });

  it('⋯ 選單「行程筆記」→ navigate 到 /trip/:id/notes', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trips-embedded-menu-trigger'));
    fireEvent.click(getByTestId('trip-embedded-menu-notes-t1'));
    expect(getByTestId('loc').textContent).toBe('/trip/t1/notes');
  });

  it('⋯ 選單「列印」→ navigate 到 /trip/:id/print', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trips-embedded-menu-trigger'));
    fireEvent.click(getByTestId('trip-embedded-menu-print-t1'));
    expect(getByTestId('loc').textContent).toBe('/trip/t1/print');
  });

  it('⋯ 選單「下載格式 PDF/JSON」→ 透過 TripPageHandleContext 呼叫 triggerDownload', () => {
    const { getByTestId, getByText } = renderAt('/trip/t1/add-stop', true, tripCtx());
    fireEvent.click(getByTestId('trips-embedded-menu-trigger'));
    fireEvent.click(getByText('PDF'));
    expect(mockTriggerDownload).toHaveBeenCalledWith('pdf');
  });

  it('手機：中欄無 TitleBar → 也無「新增景點」/「⋯」actions（bare passthrough）', () => {
    const { queryByTestId } = renderAt('/trip/t1/add-stop', false, tripCtx());
    expect(queryByTestId('trip-add-stop-trigger')).toBeNull();
    expect(queryByTestId('trips-embedded-menu-trigger')).toBeNull();
  });
});

// 分享連結：ShareLinkModal 是 API-backed component（listShares 等），這裡不整個 render
// 驗證行為（避免 test 需要 mock 網路層），改用 source-grep 鎖 wiring 與掛載,
// 與 trip-share-menu-entry.test.tsx 對 TripsListPage 的作法一致。
describe('TripStackLayout — 分享連結 wiring（source contract）', () => {
  it('中欄 TitleBar 的 onShare 開啟 ShareLinkModal（shareTripId gate）', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', '..', 'src/pages/TripStackLayout.tsx'), 'utf8');
    expect(src).toMatch(/import ShareLinkModal from/);
    expect(src).toMatch(/onShare=\{\(\) => setShareTripId\(valid\)\}/);
    expect(src).toMatch(/shareTripId && \(\s*<ShareLinkModal tripId=\{shareTripId\} open onClose/);
  });
});
