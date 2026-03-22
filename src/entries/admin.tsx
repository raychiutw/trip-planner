import { initSentry } from '../lib/sentry';
initSentry();

// SW 自動更新
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) reg.update();
  });
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../css/shared.css';
import '../../css/admin.css';
import AdminPage from '../pages/AdminPage';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <AdminPage />
    </ErrorBoundary>
  );
}
