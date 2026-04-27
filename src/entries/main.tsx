import { initSentry } from '../lib/sentry';
import { flushPendingReports } from '../components/shared/ErrorPlaceholder';
initSentry();

// 上線後自動送出離線暫存的錯誤回報
flushPendingReports();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) reg.update();
  });
}

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { NewTripProvider } from '../contexts/NewTripContext';
import { lazy, Suspense, StrictMode } from 'react';

import '../../css/tokens.css';

/**
 * Wrap dynamic import with retry + reload fallback.
 * After a deployment with new chunk hashes, users on the old version get
 * a "Failed to fetch dynamically imported module" error. This retries once,
 * then reloads to fetch fresh HTML with new chunk references.
 * sessionStorage key prevents infinite reload loops.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<P = any>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
) {
  return lazy(() =>
    importFn().catch(
      () =>
        new Promise<{ default: React.ComponentType<P> }>((resolve, reject) => {
          // Retry once after a short delay
          setTimeout(() => {
            importFn()
              .then(resolve)
              .catch(() => {
                const key = 'lazyWithRetry_reloaded';
                if (!sessionStorage.getItem(key)) {
                  sessionStorage.setItem(key, '1');
                  window.location.reload();
                  // Return a never-resolving promise while reload happens
                  return;
                }
                // Already reloaded once — clear flag and surface the error
                sessionStorage.removeItem(key);
                reject(new Error('Failed to load module after retry and reload'));
              });
          }, 1500);
        }),
    ),
  );
}

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
const MapPage = lazyWithRetry(() => import('../pages/MapPage'));
const ChatPage = lazyWithRetry(() => import('../pages/ChatPage'));
const GlobalMapPage = lazyWithRetry(() => import('../pages/GlobalMapPage'));
const ExplorePage = lazyWithRetry(() => import('../pages/ExplorePage'));
const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'));
const SignupPage = lazyWithRetry(() => import('../pages/SignupPage'));
const EmailVerifyPendingPage = lazyWithRetry(() => import('../pages/EmailVerifyPendingPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('../pages/ResetPasswordPage'));
const ConnectedAppsPage = lazyWithRetry(() => import('../pages/ConnectedAppsPage'));
const DeveloperAppsPage = lazyWithRetry(() => import('../pages/DeveloperAppsPage'));
const SessionsPage = lazyWithRetry(() => import('../pages/SessionsPage'));
const ConsentPage = lazyWithRetry(() => import('../pages/ConsentPage'));
const TripsListPage = lazyWithRetry(() => import('../pages/TripsListPage'));
const InvitePage = lazyWithRetry(() => import('../pages/InvitePage'));

const DEFAULT_TRIP = 'okinawa-trip-2026-Ray';
const FALLBACK_STYLE = { padding: '2rem', textAlign: 'center' as const };

/** 相容舊版 ?trip=xxx query string，轉為 /trips?selected=xxx route */
function LegacyRedirect() {
  const queryTrip = new URLSearchParams(window.location.search).get('trip');
  const tripId = (queryTrip && /^[\w-]+$/.test(queryTrip)) ? queryTrip : DEFAULT_TRIP;
  return <Navigate to={`/trips?selected=${encodeURIComponent(tripId)}`} replace />;
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
 * StopDetailPage 已刪。舊分享 link 仍 land 在 trip 詳情頁，未來 TripsListPage
 * 接 ?focus=:eid query 自動展開 inline expand + 開 StopLightbox 完成 deep-link。 */
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
          <NewTripProvider>
          <Suspense fallback={<div style={FALLBACK_STYLE}>載入中…</div>}>
            <Routes>
              <Route path="/admin" element={<Navigate to="/trips" replace />} />
              <Route path="/admin/" element={<Navigate to="/trips" replace />} />
              <Route path="/manage" element={<Navigate to="/chat" replace />} />
              <Route path="/manage/" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/map" element={<GlobalMapPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/signup/check-email" element={<EmailVerifyPendingPage />} />
              <Route path="/login/forgot" element={<ForgotPasswordPage />} />
              <Route path="/auth/password/reset" element={<ResetPasswordPage />} />
              <Route path="/settings/connected-apps" element={<ConnectedAppsPage />} />
              <Route path="/developer/apps" element={<DeveloperAppsPage />} />
              <Route path="/settings/sessions" element={<SessionsPage />} />
              <Route path="/oauth/consent" element={<ConsentPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/trips" element={<TripsListPage />} />
              <Route path="/trip/:tripId" element={<TripLayout />}>
                {/* Index route /trip/:tripId redirects to /trips?selected=:id —
                  * unified URL pattern. Stop sub-routes still resolve under
                  * /trip/:tripId/* for now (deep links from TimelineEvent etc). */}
                <Route index element={<TripIndexRedirect />} />
                <Route path="map" element={<MapPage />} />
                <Route path="stop/:entryId" element={<StopDetailRedirect />} />
                <Route path="stop/:entryId/map" element={<MapPage />} />
              </Route>
              <Route path="*" element={<LegacyRedirect />} />
            </Routes>
          </Suspense>
          </NewTripProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
