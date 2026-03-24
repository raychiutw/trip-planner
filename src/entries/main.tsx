import { initSentry } from '../lib/sentry';
initSentry();

// SW 自動更新（skipWaiting + clientsClaim 確保新版立即接管）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) reg.update();
  });
}

import { createRoot } from 'react-dom/client';
import TripPage from '../pages/TripPage';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

import '../../css/shared.css';
import '../../css/style.css';
import '../../css/map.css';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <TripPage />
    </ErrorBoundary>
  );
}
