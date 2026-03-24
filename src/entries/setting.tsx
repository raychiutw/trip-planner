import { initSentry } from '../lib/sentry';
initSentry();

import '../../css/shared.css';
import '../../css/setting.css';

import { createRoot } from 'react-dom/client';
import SettingPage from '../pages/SettingPage';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <SettingPage />
    </ErrorBoundary>
  );
}
