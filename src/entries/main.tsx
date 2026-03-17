import React from 'react';
import { createRoot } from 'react-dom/client';
import TripPage from '../pages/TripPage';

import '../../css/shared.css';
import '../../css/style.css';

const el = document.getElementById('reactRoot');
if (el) {
  createRoot(el).render(<TripPage />);
}
