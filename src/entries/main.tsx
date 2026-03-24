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

const TripPage = lazy(() => import('../pages/TripPage'));
const ManagePage = lazy(() => import('../pages/ManagePage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

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
            <Route path="*" element={<Navigate to="/trip/okinawa-trip-2026-Ray" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
