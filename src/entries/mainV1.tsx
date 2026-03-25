import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { lazy, Suspense } from 'react';

import '../../css/shared.css';
import '../../css/style.css';
import '../../css/map.css';

const TripPage = lazy(() => import('../pages/TripPage'));
const ManagePage = lazy(() => import('../pages/ManagePage'));

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
  createRoot(el).render(
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<div style={FALLBACK_STYLE}>載入中…</div>}>
          <Routes>
            <Route path="/trip/:tripId" element={<TripPage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="*" element={<LegacyRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
