// 本機開發的 /api 代理（#1646）。vite.config.ts 與 tests/unit/dev-proxy.test.ts 共用。
// 做法：瀏覽器同源打 /api → vite 轉到 DEV_API_PROXY_TARGET；轉送時移除 Origin，
// 讓新 api 把它當成非瀏覽器請求（沒有 Origin 就放行），不必動任何環境的 ALLOWED_ORIGINS。
// shortcut: 只適合公開唯讀端點；DPoP 的 htu 綁 api 自己的網址，經代理的登入不保證可用，登入請直連本機 api。

export function devApiProxy(env) {
  return {
    '/api': {
      target: env.DEV_API_PROXY_TARGET || 'http://localhost:8788',
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
      },
    },
  };
}
