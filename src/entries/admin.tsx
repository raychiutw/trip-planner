import { initSentry } from '../lib/sentry';
initSentry();

// SW 自動更新 + 壞 SW 自動修復
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(async (reg) => {
    if (!reg) return;

    // 觸發 SW 更新檢查
    reg.update();

    // 健康檢查：確認 SW 沒有攔截導航（navigation fallback 已關閉）
    try {
      const checkUrl = '/__sw-health-check-' + Date.now();
      const resp = await fetch(checkUrl);
      // 如果回傳 200 且 content-type 是 html → 舊 SW 的 navigation fallback 在攔截
      if (resp.ok && resp.headers.get('content-type')?.includes('text/html')) {
        console.warn('SW health check failed: navigation fallback detected, unregistering...');
        await reg.unregister();
        window.location.reload();
        return;
      }
    } catch {
      // fetch 失敗（404 或網路錯誤）= 正常，SW 沒攔截
    }
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
