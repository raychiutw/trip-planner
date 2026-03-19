import { initSentry } from '../lib/sentry';
initSentry();

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../css/shared.css';
import '../../css/admin.css';
import AdminPage from '../pages/AdminPage';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(<AdminPage />);
}
