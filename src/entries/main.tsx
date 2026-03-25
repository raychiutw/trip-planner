import { initSentry } from '../lib/sentry';
initSentry();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) reg.update();
  });
}

import { resolveV2 } from '../lib/v2routing';

const search = window.location.search;
const lsValue = typeof localStorage !== 'undefined' ? localStorage.getItem('tripline-v2') : null;
const useV2 = resolveV2(search, lsValue);

/* ?v1=1 時清除 localStorage V2 偏好，避免使用者被困在 V2 */
if (new URLSearchParams(search).get('v1') === '1' && typeof localStorage !== 'undefined') {
  localStorage.removeItem('tripline-v2');
}

/* V2 模式：僅 V2-ready 路由才 redirect（Phase 1: 只有 /admin） */
const V2_READY_PATHS = ['/admin'];
const isV2Ready = V2_READY_PATHS.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));

if (useV2 && isV2Ready) {
  const v2Url = new URL(window.location.href);
  v2Url.pathname = '/v2.html';
  v2Url.hash = window.location.pathname + window.location.search;
  window.location.replace(v2Url.toString());
} else {
  import('./mainV1');
}
