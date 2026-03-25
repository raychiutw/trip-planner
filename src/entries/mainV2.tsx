import { initSentry } from '../lib/sentry';
initSentry();

import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { lazy, Suspense, useEffect } from 'react';

import '../../css/tokens.css';

const AdminPageV2 = lazy(() => import('../pages/AdminPageV2'));

const DEFAULT_TRIP = 'okinawa-trip-2026-Ray';
const FALLBACK_STYLE = { padding: '2rem', textAlign: 'center' as const };

/** 相容舊版 ?trip=xxx query string，轉為 /trip/:tripId 路由 */
function LegacyRedirect() {
  const loc = useLocation();
  const queryTrip = new URLSearchParams(loc.search).get('trip');
  const tripId = (queryTrip && /^[\w-]+$/.test(queryTrip)) ? queryTrip : DEFAULT_TRIP;
  return <Navigate to={`/trip/${tripId}`} replace />;
}

/** 尚未 V2 化的路由 — redirect 回 V1（不影響 localStorage V2 偏好） */
function V1Fallback() {
  const loc = useLocation();
  useEffect(() => {
    // 從 hash-based path 還原為真實 URL，帶 _v1once 避免迴圈
    const target = new URL(window.location.origin + loc.pathname + loc.search);
    target.searchParams.set('v1', '1');
    window.location.replace(target.toString());
  }, [loc.pathname, loc.search]);
  return <div style={FALLBACK_STYLE}>重新導向…</div>;
}

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<div style={FALLBACK_STYLE}>載入中…</div>}>
          <Routes>
            <Route path="/admin" element={<AdminPageV2 />} />
            <Route path="/trip/:tripId" element={<V1Fallback />} />
            <Route path="/manage" element={<V1Fallback />} />
            <Route path="*" element={<LegacyRedirect />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
