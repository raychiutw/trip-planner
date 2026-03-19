import { initSentry } from '../lib/sentry';
initSentry();

import '../../css/shared.css';
import '../../css/setting.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingPage from '../pages/SettingPage';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(<SettingPage />);
}
