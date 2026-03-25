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

/* Admin 永遠走 V2（已 cutover），其他頁面依 V1/V2 切換 */
const V2_CUTOVER_PATHS = ['/admin', '/manage'];
const isCutover = V2_CUTOVER_PATHS.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));

/* V2-ready 但尚未 cutover 的路由（未來 ManagePage 等加入此列） */
const V2_READY_PATHS: string[] = [];
const isV2Ready = V2_READY_PATHS.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));

if (isCutover || (useV2 && isV2Ready)) {
  const v2Url = new URL(window.location.href);
  v2Url.pathname = '/v2.html';
  v2Url.hash = window.location.pathname + window.location.search;
  window.location.replace(v2Url.toString());
} else {
  import('./mainV1');
}
