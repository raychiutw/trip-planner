/**
 * TripStackLayout — rev2 桌機右欄操作堆疊 host（owner 2026-07-18「一次到位：6 條全接」）。
 *
 * pathless layout route，掛在 TripLayout（TripContext provider）底下、包住 6 條操作路由
 * （加景點/新增/複製移動/換景點/編輯 entry/編輯行程）。
 *
 * 桌機（≥1024）：render 3 欄 shell —— sidebar ｜ 中欄行程詳情（<TripPage noShell>）｜
 *   右欄 sheet = <Outlet/>（操作頁經 OperationShell 以 bare panel 塞入）。
 *   操作間切換（加景點→換景點）本 layout 不 unmount → 中欄詳情保留、只右欄換。
 * 手機（<1024）：直接 <Outlet/> → 操作頁 render 自己整頁（inStack 預設 false）。
 *
 * ✕「整個關閉」= navigate 回 /trips?selected=:id（行程詳情）。
 */
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { SheetStackProvider } from '../contexts/SheetStackContext';
import { routes } from '../lib/routes';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TripPage from './TripPage';

export default function TripStackLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  // 手機：操作頁自己整頁 render（既有行為）。
  if (!isDesktop) return <Outlet />;

  const valid = tripId && /^[\w-]+$/.test(tripId) ? tripId : null;

  return (
    <SheetStackProvider
      value={{
        inStack: true,
        closeStack: () => navigate(valid ? routes.tripsSelected(valid) : routes.trips()),
      }}
    >
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={valid ? <TripPage tripId={valid} noShell /> : null}
        sheet={<Outlet />}
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
    </SheetStackProvider>
  );
}
