import { initSentry } from '../lib/sentry';
initSentry();

// 強制更新舊 SW：如果 SW 沒有 navigateFallbackDenylist，重新註冊
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.update(); // 觸發 SW 更新檢查
    }
  });
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import TripPage from '../pages/TripPage';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

import '../../css/shared.css';
import '../../css/style.css';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <TripPage />
    </ErrorBoundary>
  );
}
