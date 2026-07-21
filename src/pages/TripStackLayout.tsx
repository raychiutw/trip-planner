/**
 * TripStackLayout — rev2 桌機右欄操作堆疊 host（owner 2026-07-18「一次到位：6 條全接」，
 * 2026-07-21 補中欄 TitleBar，2026-07-21 第二輪補中欄 actions）。
 *
 * pathless layout route，掛在 TripLayout（TripContext provider）底下、包住操作路由
 * （加景點/新增/複製移動/換景點/編輯 entry/編輯行程 + v2.57.x 遷入的共編設定/AI 健檢/行程筆記）。
 *
 * 桌機（≥1024）：render 3 欄 shell —— sidebar ｜ 中欄（TitleBar + <TripPage noShell>）｜
 *   右欄 sheet = <Outlet/>（操作頁經 OperationShell 以 bare panel 塞入）。
 *   操作間切換（加景點→換景點）本 layout 不 unmount → 中欄詳情保留、只右欄換。
 * 手機（<1024）：直接 <Outlet/> → 操作頁 render 自己整頁（inStack 預設 false）。
 *
 * ✕「整個關閉」= navigate 回 /trips?selected=:id（行程詳情）。
 *
 * 中欄 TitleBar（v2.57.x 新增）：owner 2026-07-21「開啟第三欄時第二欄 header 不要消失」——
 * 2026-07-19 原決策「中欄無 titlebar」（見 tokens.css `.tp-stack-mid` 註解）在此補回一個輕量
 * 版本（行程名稱 + 返回）。返回 action 直接用 closeStack（與右欄 ✕ 同語意 —— 兩者都是「離開
 * 這個操作堆疊，回到 /trips?selected=:id 的一般行程檢視」）。
 *
 * 中欄 actions（v2.57.x 第二輪，owner 回報 #1「第三欄開啟後第二欄操作入口消失」）：
 * 第一版刻意只放標題 + 返回、不重造 TripsListPage 的完整 switcher/⋯ menu ——結果就是
 * 開了任一操作面板（含新遷入的共編/健檢/筆記）之後，使用者原本在 /trips?selected=X
 * 就有的「新增景點 / 編輯行程 / 共編設定 / AI 健檢 / 行程筆記 / 列印 / 分享連結 / 下載」
 * 全部不見。這裡把 TripsListPage embedded 詳情用的 TripActionsMenu（v2.57.x 從
 * TripsListPage 的 EmbeddedActionMenu 抽出共用）接回中欄 TitleBar，行為與 TripsListPage
 * 那份完全一致（同一元件、同 testid），只是不重做 TripTitleSwitcher（切換行程已有
 * DesktopSidebar 的「我的行程」清單可用，不重複）。
 *
 * trip 名稱讀 TripLayout 已提供的 TripContext，免多打一次 API。
 *
 * 中欄 <TripPage>（v2.57.x 第三輪，owner 回報 #2「開關第三欄面板會刷新第二欄」）：
 * 不再由這裡 inline render —— 那正是路由在 /trips?selected=X ↔
 * /trip/:id/{edit|...} 之間切換時造成 TripPage unmount/remount（=中欄刷新）的
 * root cause 之一。改留一個 portal placeholder（callback ref 交給
 * TripMainPortalContext），main.tsx 的 TripPageHost（唯一持續存在、掛在
 * <Routes> 之上的 <TripPage> 實例）會把內容 portal 進來。TripActionsMenu 需要的
 * tripPageRef 也改從 TripPageHandleContext 拿 TripPageHost 持有的那一份
 * （不再自己建立一個永遠不會被 attach 的 dead ref）。
 */
import { useContext, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { SheetStackProvider } from '../contexts/SheetStackContext';
import { TripContext } from '../contexts/TripContext';
import { useTripPageHandle } from '../contexts/TripPageHandleContext';
import { useTripMainPortal } from '../contexts/TripMainPortalContext';
import { TRIP_MAIN_PORTAL_ID } from '../lib/tripStackRoutes';
import { routes } from '../lib/routes';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import TripActionsMenu from '../components/trip/TripActionsMenu';
import ShareLinkModal from '../components/share/ShareLinkModal';

export default function TripStackLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const tripCtx = useContext(TripContext);
  const tripPageRef = useTripPageHandle();
  const { setPortalNode } = useTripMainPortal();
  const [shareTripId, setShareTripId] = useState<string | null>(null);
  const valid = tripId && /^[\w-]+$/.test(tripId) ? tripId : null;

  // ✕「整個關閉」回行程詳情（桌機+手機共用）。replace → 關閉後瀏覽器上一頁不會又把
  // 面板叫回來。
  const closeStack = () =>
    navigate(valid ? routes.tripsSelected(valid) : routes.trips(), { replace: true });

  // 手機：操作頁整頁 drill-down render（OperationShell !inStack 分支），但仍注入 closeStack
  // 讓共用 header 的「✕ 整個關閉」可用。
  // 已知取捨：桌機（3 欄 host）與手機（bare Outlet）是結構不同的 tree，跨越 1024px 邊界
  // （旋轉 / 瀏覽器縮放改變 CSS-px）會 unmount/remount 操作頁 → 未存檔表單 state 會丟
  // （多數操作頁 autosave 兜底）；要完全消除需讓 Outlet 跨斷點掛同一 tree 位置（非本 PR 範圍）。
  if (!isDesktop) {
    return (
      <SheetStackProvider value={{ inStack: false, closeStack }}>
        <Outlet />
      </SheetStackProvider>
    );
  }

  const tripTitle = tripCtx?.trip
    ? (tripCtx.trip.title?.trim() || tripCtx.trip.name?.trim() || '行程')
    : (tripCtx?.loading !== false ? '載入中…' : '行程');

  return (
    <SheetStackProvider value={{ inStack: true, closeStack }}>
      {/* §8.1：中欄包 .tp-stack-mid marker。中欄現有 TitleBar（v2.57.x 補回），
          day-tabs sticky top 沿用一般 `.tp-map-day-tabs--sticky` 預設偏移即可
          （見 css/tokens.css，舊「無 titlebar → top:8px」override 已移除）。 */}
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={valid ? (
          <div className="tp-stack-mid">
            <TitleBar
              title={tripTitle}
              back={closeStack}
              backLabel="返回行程列表"
              actions={(
                <>
                  <button
                    type="button"
                    className="tp-titlebar-action tp-titlebar-action--icon-only"
                    onClick={() => navigate(`/trip/${encodeURIComponent(valid)}/add-entry`)}
                    aria-label="新增景點"
                    title="新增景點"
                    data-testid="trip-add-stop-trigger"
                  >
                    <Icon name="plus" />
                  </button>
                  <TripActionsMenu
                    tripId={valid}
                    tripPageRef={tripPageRef}
                    onEdit={() => navigate(routes.tripEdit(valid))}
                    onCollab={() => navigate(routes.tripCollab(valid))}
                    onHealthCheck={() => navigate(routes.tripHealth(valid))}
                    onNotes={() => navigate(`/trip/${encodeURIComponent(valid)}/notes`)}
                    onPrint={() => navigate(`/trip/${encodeURIComponent(valid)}/print`)}
                    onShare={() => setShareTripId(valid)}
                  />
                </>
              )}
            />
            <div ref={setPortalNode} data-testid={TRIP_MAIN_PORTAL_ID} />
          </div>
        ) : null}
        sheet={<Outlet />}
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
      {shareTripId && (
        <ShareLinkModal tripId={shareTripId} open onClose={() => setShareTripId(null)} />
      )}
    </SheetStackProvider>
  );
}
