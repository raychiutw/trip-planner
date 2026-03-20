import { initSentry } from '../lib/sentry';
initSentry();

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
