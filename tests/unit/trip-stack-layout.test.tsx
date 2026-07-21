/**
 * TripStackLayout — rev2 桌機右欄操作堆疊 host 的分支 + 導航契約。
 *
 * 桌機（useMediaQuery=true）→ 3 欄 shell（sidebar｜中欄 <TripPage noShell>｜右欄 Outlet），
 *   context inStack=true、closeStack → /trips?selected=:id。
 * 手機（false）→ passthrough bare <Outlet>（無第二個 shell / 無中欄詳情、inStack 預設 false）。
 * invalid :tripId → 中欄不掛 TripPage（main=null）、closeStack fallback /trips。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import TripStackLayout from '../../src/pages/TripStackLayout';
import { useSheetStack } from '../../src/contexts/SheetStackContext';
import { TripContext } from '../../src/contexts/TripContext';
import type { UseTripReturn } from '../../src/hooks/useTrip';
import type { Trip } from '../../src/types/trip';

let mockIsDesktop = true;
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockIsDesktop,
}));
// 中欄詳情 / sidebar / bottom-nav 的重依賴（/api/trips fetch、地圖）在此 stub 掉。
vi.mock('../../src/pages/TripPage', () => ({
  default: ({ tripId, noShell }: { tripId?: string; noShell?: boolean }) => (
    <div data-testid="mock-trip-detail" data-no-shell={String(noShell)}>{tripId}</div>
  ),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({
  default: () => <div data-testid="mock-sidebar" />,
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { userId: 'u1', email: 'ray@example.com' } }),
}));

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
      <TripContext.Provider value={tripCtx}>
        <Routes>
          <Route path="/trips" element={<div data-testid="trips-page">trips</div>} />
          <Route path="/trip/:tripId" element={<TripStackLayout />}>
            <Route path="add-stop" element={<OperationStub />} />
            <Route path="stop/:entryId/change-poi" element={<OperationStub />} />
          </Route>
        </Routes>
      </TripContext.Provider>
    </MemoryRouter>,
  );
}

describe('TripStackLayout — 桌機/手機分支 + 導航', () => {
  beforeEach(() => {
    mockIsDesktop = true;
  });

  it('桌機：render 3 欄 host（sidebar｜中欄 TripPage noShell｜右欄 Outlet 操作），inStack=true', () => {
    const { getByTestId } = renderAt('/trip/t1/add-stop', true);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('app-shell').getAttribute('data-layout')).toBe('3pane');
    expect(getByTestId('mock-sidebar')).toBeTruthy();
    const detail = getByTestId('mock-trip-detail');
    expect(detail.textContent).toBe('t1');
    expect(detail.getAttribute('data-no-shell')).toBe('true');
    const op = getByTestId('op-stub');
    expect(op).toBeTruthy();
    expect(op.getAttribute('data-in-stack')).toBe('true');
  });

  it('手機：passthrough bare Outlet — 無 app-shell、無中欄詳情，inStack 預設 false', () => {
    const { getByTestId, queryByTestId } = renderAt('/trip/t1/add-stop', false);
    expect(queryByTestId('app-shell')).toBeNull();
    expect(queryByTestId('mock-trip-detail')).toBeNull();
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
    expect(getByTestId('mock-trip-detail').textContent).toBe('t1');
  });

  it('invalid :tripId → 中欄不掛 TripPage（main=null）、closeStack fallback /trips', () => {
    const { getByTestId, queryByTestId } = renderAt('/trip/bad!id/add-stop', true);
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(queryByTestId('mock-trip-detail')).toBeNull();
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
