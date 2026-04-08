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
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const DEFAULT_TRIP = 'okinawa-trip-2026-Ray';
const FALLBACK_STYLE = { padding: '2rem', textAlign: 'center' as const };

/** 相容舊版 ?trip=xxx query string，轉為 /trip/:tripId 路由 */
function LegacyRedirect() {
  const queryTrip = new URLSearchParams(window.location.search).get('trip');
  const tripId = (queryTrip && /^[\w-]+$/.test(queryTrip)) ? queryTrip : DEFAULT_TRIP;
  return <Navigate to={`/trip/${tripId}`} replace />;
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
              <Route path="/trip/:tripId" element={<TripPage />} />
              <Route path="*" element={<LegacyRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
