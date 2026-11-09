/**
 * service worker 的公開行程離線快取規則（#1645）。
 * 抽成獨立模組讓單元測試可直接驗證；vite.config.ts 以 VITE_API_BASE_URL 呼叫。
 *
 * 注意：workbox 會把 cacheWillUpdate 以 toString() 內嵌進 sw.js，
 * 所以它必須自給自足（不可參照模組內其他變數）。
 */
const cacheWillUpdate = async ({ request, response }) => {
  // 帶憑證的請求（bearer／DPoP／舊 cookie）不進共用快取，避免登出後下個使用者讀到上個人的資料
  if (request.headers.get('Authorization') || request.headers.get('DPoP') || request.headers.get('Cookie')) return null;
  // opaque 回應讀不到 Cache-Control，無法判斷是否 private，一律不收
  if (response.type === 'opaque' || response.status === 0) return null;
  const cc = response.headers.get('Cache-Control') ?? '';
  if (cc.includes('private') || cc.includes('no-store')) return null;
  return response;
};

const rule = (urlPattern, cacheName) => ({
  urlPattern,
  handler: 'NetworkFirst',
  options: {
    cacheName,
    expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
    networkTimeoutSeconds: 5,
    // 新 api 為 CORS 請求（回應 type=cors、標頭可讀），只收 200；不收 opaque(0)
    cacheableResponse: { statuses: [200] },
    fetchOptions: { cache: 'no-cache' },
    plugins: [{ cacheWillUpdate }],
  },
  method: 'GET',
});

/** apiBase 為 VITE_API_BASE_URL（如 https://xxx.workers.dev，無尾斜線）；空值則只留 dev 規則。 */
export function swRuntimeCaching(apiBase) {
  const origin = apiBase ? new URL(apiBase).origin.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') : '';
  return [
    // 只快取公開行程端點（/api/trips/*），排除 /api/permissions、/api/requests 等需認證端點
    ...(origin ? [rule(new RegExp(`^${origin}/api/trips/.*`), 'api-cache')] : []),
    // Dev proxy
    rule(/^http:\/\/localhost:\d+\/api\/trips\/.*/, 'api-cache-dev'),
  ];
}
