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
import { lazy, Suspense, StrictMode } from 'react';

import '../../css/tokens.css';

/**
 * Wrap dynamic import with retry + reload fallback.
 * After a deployment with new chunk hashes, users on the old version get
 * a "Failed to fetch dynamically imported module" error. This retries once,
 * then reloads to fetch fresh HTML with new chunk references.
 * sessionStorage key prevents infinite reload loops.
 */
function lazyWithRetry(
  importFn: () => Promise<{ default: React.ComponentType<unknown> }>,
) {
  return lazy(() =>
    importFn().catch(
      () =>
        new Promise<{ default: React.ComponentType<unknown> }>((resolve, reject) => {
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

const AdminPage = lazyWithRetry(() => import('../pages/AdminPage'));
const ManagePage = lazyWithRetry(() => import('../pages/ManagePage'));
const TripPage = lazyWithRetry(() => import('../pages/TripPage'));
const TripLayout = lazyWithRetry(() => import('../pages/TripLayout'));
const StopDetailPage = lazyWithRetry(() => import('../pages/StopDetailPage'));
const MapPage = lazyWithRetry(() => import('../pages/MapPage'));
const ChatPage = lazyWithRetry(() => import('../pages/ChatPage'));
const GlobalMapPage = lazyWithRetry(() => import('../pages/GlobalMapPage'));
const ExplorePage = lazyWithRetry(() => import('../pages/ExplorePage'));
const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('../pages/ResetPasswordPage'));
const ConsentPage = lazyWithRetry(() => import('../pages/ConsentPage'));

const DEFAULT_TRIP = 'okinawa-trip-2026-Ray';
const FALLBACK_STYLE = { padding: '2rem', textAlign: 'center' as const };

/** 相容舊版 ?trip=xxx query string，轉為 /trip/:tripId 路由 */
function LegacyRedirect() {
  const queryTrip = new URLSearchParams(window.location.search).get('trip');
  const tripId = (queryTrip && /^[\w-]+$/.test(queryTrip)) ? queryTrip : DEFAULT_TRIP;
  return <Navigate to={`/trip/${tripId}`} replace />;
}

/** /trip/:tripId/map → /trip/:tripId?sheet=map（保留其他 query params）*/
function TripMapRedirect() {
  const { tripId } = useParams<{ tripId: string }>();
  const { search } = useLocation();
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set('sheet', 'map');
  const query = params.toString();
  return <Navigate to={`/trip/${tripId ?? ''}${query ? `?${query}` : ''}`} replace />;
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
          <Suspense fallback={<div style={FALLBACK_STYLE}>載入中…</div>}>
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/" element={<AdminPage />} />
              <Route path="/manage" element={<ManagePage />} />
              <Route path="/manage/" element={<ManagePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/map" element={<GlobalMapPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/forgot" element={<ForgotPasswordPage />} />
              <Route path="/auth/password/reset" element={<ResetPasswordPage />} />
              <Route path="/oauth/consent" element={<ConsentPage />} />
              <Route path="/trip/:tripId" element={<TripLayout />}>
                <Route index element={<TripPage />} />
                <Route path="map" element={<TripMapRedirect />} />
                <Route path="stop/:entryId" element={<StopDetailPage />} />
                <Route path="stop/:entryId/map" element={<MapPage />} />
              </Route>
              <Route path="*" element={<LegacyRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
