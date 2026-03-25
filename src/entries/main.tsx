import { initSentry } from '../lib/sentry';
initSentry();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) reg.update();
  });
}

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { lazy, Suspense } from 'react';

import '../../css/shared.css';
import '../../css/style.css';
import '../../css/map.css';

/* V1/V2 路由切換 — Blue-Green Tailwind 遷移 */
const params = new URLSearchParams(window.location.search);
const forceV1 = params.get('v1') === '1';
const forceV2 = params.get('v2') === '1';
const storedV2 = typeof localStorage !== 'undefined' && localStorage.getItem('tripline-v2') === '1';
export const useV2 = !forceV1 && (forceV2 || storedV2);

const TripPage = lazy(() => import('../pages/TripPage'));
const ManagePage = lazy(() => import('../pages/ManagePage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

const DEFAULT_TRIP = 'okinawa-trip-2026-Ray';

/** 相容舊版 ?trip=xxx query string，轉為 /trip/:tripId 路由 */
function LegacyRedirect() {
  const queryTrip = new URLSearchParams(window.location.search).get('trip');
  const tripId = (queryTrip && /^[\w-]+$/.test(queryTrip)) ? queryTrip : DEFAULT_TRIP;
  return <Navigate to={`/trip/${tripId}`} replace />;
}

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>載入中…</div>}>
          <Routes>
            <Route path="/trip/:tripId" element={<TripPage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<LegacyRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
