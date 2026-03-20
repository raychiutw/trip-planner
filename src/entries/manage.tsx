import { initSentry } from '../lib/sentry';
initSentry();

import '../../css/shared.css';
import '../../css/manage.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ManagePage from '../pages/ManagePage';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(
    <ErrorBoundary>
      <ManagePage />
    </ErrorBoundary>
  );
}
