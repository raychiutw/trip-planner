import { initSentry } from '../lib/sentry';
import { flushPendingReports } from '../components/shared/ErrorPlaceholder';
initSentry();

// 上線後自動送出離線暫存的錯誤回報
flushPendingReports();

// v2.33.67 round 17: 清掉 lazyWithRetry 上次 reload 留下的 flag。之前 successful
// reload 後此 key 永遠殘留，下次任何 chunk load fail 直接 reject 無 retry，等於
// 重試機制只能用一次/tab session。Mount 時清掉 = 每次 fresh load 都重置 retry budget。
sessionStorage.removeItem('lazyWithRetry_reloaded');

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  const reloadKey = 'tp-sw-controller-reload';
  sessionStorage.removeItem(reloadKey);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  });
  // SW load 失敗（iOS Chrome 偶發 TypeError/SecurityError）會讓 getRegistration 或
  // reg.update() reject。沒 catch 會 bubble 成 unhandled rejection 進 Sentry。
  // 真實 user 沒 functional impact（SW 是 enhancement），靜默吞 reject。
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (reg) return reg.update();
    })
    .catch(() => {});
}

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { NewTripProvider } from '../contexts/NewTripContext';
import { ActiveTripProvider } from '../contexts/ActiveTripContext';
import { Suspense, StrictMode } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { ServerStatusBanner } from '../components/ServerStatusBanner';

/**
 * v2.31.25 fix #126: dark mode init root-level component。
 * useDarkMode 之前只在 ThemeToggle / TripPage / GlobalMapPage 三處 mount，
 * user 切「深」模式後切到 /trips /chat /favorites /explore 等 page，
 * body.dark class 不會被 set → page bg 還是 light（localStorage 已存「dark」但 class 沒同步）。
 * 把 hook mount 在 app root 確保每次 page mount 都 init body.dark。
 */
function DarkModeInit() {
  useDarkMode();
  return null;
}

import '../../css/tokens.css';
import { lazyWithRetry } from '../lib/lazyWithRetry';

// AdminPage removed 2026-04-26 (PR-O) — admin 共編管理拆進每個 trip 的
// OverflowMenu →「共編設定」 sheet (CollabSheet)，一般 user 也可管自己 owner
// 行程。/admin 維持 backward-compat redirect 到 /trips。
// ManagePage removed 2026-04-26 — superseded by /chat. tp-request skill on
// Mac Mini auto-classifies improve-trip vs question intent; the legacy
// chat-style editor at /manage is redundant. /manage now redirects to /chat.
// TripPage is no longer a route component — it's embedded inside TripsListPage
// when /trips?selected=X. Direct /trip/:tripId index URLs redirect to /trips via
// TripIndexRedirect. /trip/:tripId/map remains a full-bleed MapPage route.
// v2.10 Wave 1：StopDetailPage 移除（PR2 後 list 不再連到，這裡保留 URL
// backward-compat：/trip/:id/stop/:eid → /trips?selected=:id&focus=:eid，
// 供舊分享 link 仍能 land）。MapPage 仍可走 /trip/:id/stop/:eid/map。
const TripLayout = lazyWithRetry(() => import('../pages/TripLayout'));
// rev2 owner 2026-07-18「6 條全接」：桌機右欄操作堆疊 host（pathless layout route，
// 包住 6 條操作路由；桌機 3 欄詳情+右欄 panel、手機整頁）。
const TripStackLayout = lazyWithRetry(() => import('../pages/TripStackLayout'));
const MapPage = lazyWithRetry(() => import('../pages/MapPage'));
const ChatPage = lazyWithRetry(() => import('../pages/ChatPage'));
const GlobalMapPage = lazyWithRetry(() => import('../pages/GlobalMapPage'));
const ExplorePage = lazyWithRetry(() => import('../pages/ExplorePage'));
// poi-favorites-rename: 「收藏」primary nav (/favorites)
const PoiFavoritesPage = lazyWithRetry(() => import('../pages/PoiFavoritesPage'));
const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'));
const SignupPage = lazyWithRetry(() => import('../pages/SignupPage'));
const EmailVerifyPendingPage = lazyWithRetry(() => import('../pages/EmailVerifyPendingPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('../pages/ResetPasswordPage'));
const VerifyEmailPage = lazyWithRetry(() => import('../pages/VerifyEmailPage'));
const ConnectedAppsPage = lazyWithRetry(() => import('../pages/ConnectedAppsPage'));
const DeveloperAppsPage = lazyWithRetry(() => import('../pages/DeveloperAppsPage'));
const DeveloperAppNewPage = lazyWithRetry(() => import('../pages/DeveloperAppNewPage'));
const SessionsPage = lazyWithRetry(() => import('../pages/SessionsPage'));
// Section 2 (terracotta-account-hub-page) — unified Account hub + sub-settings
const AccountPage = lazyWithRetry(() => import('../pages/AccountPage'));
const AppearanceSettingsPage = lazyWithRetry(() => import('../pages/AppearanceSettingsPage'));
const NotificationsSettingsPage = lazyWithRetry(() => import('../pages/NotificationsSettingsPage'));
const ConsentPage = lazyWithRetry(() => import('../pages/ConsentPage'));
const TripsListPage = lazyWithRetry(() => import('../pages/TripsListPage'));
const InvitePage = lazyWithRetry(() => import('../pages/InvitePage'));
// v2.18.0:共編 sheet 升格獨立頁面
const CollabPage = lazyWithRetry(() => import('../pages/CollabPage'));
const EditTripPage = lazyWithRetry(() => import('../pages/EditTripPage'));
const NewTripPage = lazyWithRetry(() => import('../pages/NewTripPage'));
// 未登入首頁。已登入者由 LandingPage 內部導向 /trips。
const LandingPage = lazyWithRetry(() => import('../pages/LandingPage'));
const EntryActionPage = lazyWithRetry(() => import('../pages/EntryActionPage'));
const AddStopPage = lazyWithRetry(() => import('../pages/AddStopPage'));
const AddCustomStopPage = lazyWithRetry(() => import('../pages/AddCustomStopPage'));
// v2.32.0: 「新增景點」EditEntryPage 形狀的 wizard page，day 下拉 + 3 個 picker buttons。
const AddEntryPage = lazyWithRetry(() => import('../pages/AddEntryPage'));
// v2.31.94: mobile-only route guard
import { MobileOnlyRoute } from '../components/MobileOnlyRoute';
// poi-favorites-rename: poi_favorites universal pool → 加入行程 fast-path page
const AddPoiFavoriteToTripPage = lazyWithRetry(() => import('../pages/AddPoiFavoriteToTripPage'));
// v2.23.8: 變更 POI 全頁 form
const ChangePoiPage = lazyWithRetry(() => import('../pages/ChangePoiPage'));
// v2.26.0: 編輯 entry 全頁 form (起訖時間 + 從上一站移動方式 + 備註)
const EditEntryPage = lazyWithRetry(() => import('../pages/EditEntryPage'));
// v2.31.0: AI 健檢全頁 (severity-grouped findings, polling pending state)
const TripHealthCheckPage = lazyWithRetry(() => import('../pages/TripHealthCheckPage'));
const TripNotesPage = lazyWithRetry(() => import('../pages/TripNotesPage'));
const TripPrintPage = lazyWithRetry(() => import('../pages/TripPrintPage'));
// v2.39.0: 無登入公開分享頁 /s/:token（不呼叫 useRequireAuth）
const TripSharePage = lazyWithRetry(() => import('../pages/TripSharePage'));

const FALLBACK_STYLE = { padding: '2rem', textAlign: 'center' as const };

/** 相容舊版 ?trip=xxx query string，轉為 /trips?selected=xxx route。
 *  v2.31.59 fix：原本 fallback 寫死 'okinawa-trip-2026-Ray'（admin 的 trip），
 *  其他 user 走 unknown route 會被 redirect 到非自己的 trip → 403。
 *  改成沒 valid ?trip= 就回 /trips（無 selected param 讓 TripsListPage
 *  fallback 到 user 最新編輯 trip 或顯示 empty state）。 */
function LegacyRedirect() {
  const queryTrip = new URLSearchParams(window.location.search).get('trip');
  if (queryTrip && /^[\w-]+$/.test(queryTrip)) {
    return <Navigate to={`/trips?selected=${encodeURIComponent(queryTrip)}`} replace />;
  }
  return <Navigate to="/trips" replace />;
}

/** /trip/:tripId index → /trips?selected=:tripId（unified URL pattern）*/
function TripIndexRedirect() {
  const { tripId } = useParams<{ tripId: string }>();
  const { search } = useLocation();
  const incoming = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  // Forward existing query params (?sheet=map etc) onto the new URL
  incoming.set('selected', tripId ?? '');
  return <Navigate to={`/trips?${incoming.toString()}`} replace />;
}

/** v2.10 Wave 1: /trip/:tripId/stop/:entryId → /trips?selected=:tripId&focus=:entryId
 *
 * StopDetailPage 已刪。舊分享 link 仍 land 在 trip 詳情頁，TripPage 讀 ?focus=:eid
 * 捲到該 entry、TimelineRail 依同一個 param 展開 inline 明細 —— deep-link 到此完成。
 *
 * v2.55.78 更正：原註解寫「+ 開 StopLightbox」，但 codebase 從來沒有 focus →
 * setLightboxOpen 的路徑（?focus 只展開 inline，見 TripPage.tsx 的 ?focus 處理），
 * 那句一直是假的。StopLightbox 本身也已移除（見 DESIGN.md Allowed Modal Components）。
 * 依 DESIGN.md「想 deep-link 給隊友看『我在這個畫面』→ 全頁」，展開的 inline 明細
 * 就是正解，不該是 modal。 */
function StopDetailRedirect() {
  const { tripId, entryId } = useParams<{ tripId: string; entryId: string }>();
  const params = new URLSearchParams();
  params.set('selected', tripId ?? '');
  if (entryId) params.set('focus', entryId);
  return <Navigate to={`/trips?${params.toString()}`} replace />;
}

const el = document.getElementById('reactRoot');
if (el) {
  // Reuse existing root on Vite HMR to avoid "createRoot on same container" error
  const existingRoot = (el as unknown as { _reactRoot?: ReturnType<typeof createRoot> })._reactRoot;
  const root = existingRoot ?? createRoot(el);
  (el as unknown as { _reactRoot: typeof root })._reactRoot = root;

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <DarkModeInit />
          <ServerStatusBanner />
          <ActiveTripProvider>
          <NewTripProvider>
          <Suspense fallback={<div style={FALLBACK_STYLE}>載入中…</div>}>
            <Routes>
              {/* `/` 改指向未登入首頁。改版前落到 path="*" → LegacyRedirect → /trips → /login，
                  訪客永遠看不到這個 app 在做什麼。已登入者由 LandingPage 導回 /trips。 */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/admin" element={<Navigate to="/trips" replace />} />
              <Route path="/admin/" element={<Navigate to="/trips" replace />} />
              <Route path="/manage" element={<Navigate to="/chat" replace />} />
              <Route path="/manage/" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/map" element={<GlobalMapPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              {/* poi-favorites-rename: PoiFavoritesPage primary nav route */}
              <Route path="/favorites" element={<PoiFavoritesPage />} />
              {/* poi-favorites-rename: poi_favorites → trip fast-path page (D-C1 + D-C2)，4-field 純時間驅動 */}
              <Route path="/favorites/:id/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
              {/* v2.23.8: direct-mode add-to-trip — Explore POI 不需先收藏，query params 帶 POI 進來 */}
              <Route path="/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/signup/check-email" element={<EmailVerifyPendingPage />} />
              <Route path="/login/forgot" element={<ForgotPasswordPage />} />
              <Route path="/auth/password/reset" element={<ResetPasswordPage />} />
              {/* v2.33.59 round 13 H2: email-link landing page (auto-POST verify) */}
              <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
              {/* v2.39.0: 無登入公開分享頁 — token 不可猜，TripSharePage 不呼叫 useRequireAuth */}
              <Route path="/s/:token" element={<TripSharePage />} />
              <Route path="/settings/connected-apps" element={<ConnectedAppsPage />} />
              <Route path="/developer/apps" element={<DeveloperAppsPage />} />
              {/* 2026-05-03 modal-to-fullpage migration: create-app modal → /developer/apps/new */}
              <Route path="/developer/apps/new" element={<DeveloperAppNewPage />} />
              <Route path="/settings/sessions" element={<SessionsPage />} />
              {/* Section 2 (terracotta-account-hub-page) routes */}
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/appearance" element={<AppearanceSettingsPage />} />
              <Route path="/account/notifications" element={<NotificationsSettingsPage />} />
              {/* v2.32.4 cross-prefix aliases: account hub 用 /account/*, sessions/connected-apps
                  歷史在 /settings/*。User 直接打 URL 或舊書籤可能用任一 prefix → 兩個都 valid。 */}
              <Route path="/account/sessions" element={<SessionsPage />} />
              <Route path="/account/connected-apps" element={<ConnectedAppsPage />} />
              <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
              <Route path="/settings/notifications" element={<NotificationsSettingsPage />} />
              <Route path="/oauth/consent" element={<ConsentPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/trips" element={<TripsListPage />} />
              {/* 2026-05-03 modal-to-fullpage migration: NewTripModal → /trips/new */}
              <Route path="/trips/new" element={<NewTripPage />} />
              <Route path="/trip/:tripId" element={<TripLayout />}>
                {/* Index route /trip/:tripId redirects to /trips?selected=:id —
                  * unified URL pattern. Stop sub-routes still resolve under
                  * /trip/:tripId/* for now (deep links from TimelineEvent etc). */}
                <Route index element={<TripIndexRedirect />} />
                <Route path="map" element={<MapPage />} />
                <Route path="stop/:entryId" element={<StopDetailRedirect />} />
                <Route path="stop/:entryId/map" element={<MapPage />} />
                {/* v2.18.0:共編設定獨立頁(取代 ?sheet=collab bottom-sheet) */}
                <Route path="collab" element={<CollabPage />} />
                <Route path="health" element={<TripHealthCheckPage />} />
                {/* v2.34.x 行程筆記 — 5 section accordion + AI gen pretrip/emergency */}
                <Route path="notes" element={<TripNotesPage />} />
                {/* v2.36.0 列印文件 — 資料驅動全展開文件（取代 usePrintMode 收合列印） */}
                <Route path="print" element={<TripPrintPage />} />
                {/* rev2 owner 2026-07-18「6 條全接」：6 條操作路由包進 TripStackLayout。
                  * 桌機 → 右欄 bare panel 疊在中欄行程詳情上（‹ 前一頁 / ✕ 整個關閉）；
                  * 手機 → 各頁整頁（OperationShell inStack=false，既有行為）。 */}
                <Route element={<TripStackLayout />}>
                  {/* 2026-05-03 modal-to-fullpage migration: EditTripModal → /trip/:id/edit */}
                  <Route path="edit" element={<EditTripPage />} />
                  {/* 2026-05-03 modal-to-fullpage migration: EntryActionPopover → /stop/:eid/(copy|move) */}
                  <Route path="stop/:entryId/copy" element={<EntryActionPage action="copy" />} />
                  <Route path="stop/:entryId/move" element={<EntryActionPage action="move" />} />
                  {/* v2.23.8 變更 POI — :tripId + :entryId from parent route */}
                  <Route path="stop/:entryId/change-poi" element={<ChangePoiPage />} />
                  {/* v2.26.0 編輯景點（起訖時間 + 從上一站移動方式 + 備註） */}
                  <Route path="stop/:entryId/edit" element={<EditEntryPage />} />
                  {/* 2026-05-03 modal-to-fullpage migration: AddStopModal → /add-stop?day=N */}
                  <Route path="add-stop" element={<AddStopPage />} />
                  {/* v2.32.0: 新增景點 wizard — EditEntryPage 形狀 + day 下拉 + picker buttons → ChangePoiPage mode=new */}
                  <Route path="add-entry" element={<AddEntryPage />} />
                </Route>
                {/* v2.31.94: mobile-only fullpage 自訂景點（IME occlusion 避讓）— desktop redirect 回 add-stop?tab=custom */}
                <Route
                  path="add-custom-stop"
                  element={
                    <MobileOnlyRoute fallbackPath="/trips">
                      <AddCustomStopPage />
                    </MobileOnlyRoute>
                  }
                />
              </Route>
              <Route path="*" element={<LegacyRedirect />} />
            </Routes>
          </Suspense>
          </NewTripProvider>
          </ActiveTripProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
