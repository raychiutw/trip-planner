import { initSentry } from '../lib/sentry';
initSentry();

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { lazy, Suspense } from 'react';

import '../../css/tokens.css';

const AdminPage = lazy(() => import('../pages/AdminPage'));
const ManagePage = lazy(() => import('../pages/ManagePageV2'));

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
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/" element={<AdminPage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="/manage/" element={<ManagePage />} />
            <Route path="*" element={<LegacyRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
