import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { mockApiPlugin } from './scripts/vite-mock-api';

// Only upload source maps to Sentry in CI (when SENTRY_AUTH_TOKEN is present).
// B-P6 task 10.1：mark release with package version + commit SHA。
// CI（GitHub Actions）有 GITHUB_SHA env；fallback 到 explicit SENTRY_RELEASE 或 'local'。
const sentryRelease =
  process.env.SENTRY_RELEASE ||
  `tripline@${process.env.npm_package_version || '0.0.0'}-${
    (process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || 'local').slice(0, 7)
  }`;

const sentryPlugins = process.env.SENTRY_AUTH_TOKEN
  ? [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: sentryRelease },
      }),
    ]
  : [];

export default defineConfig({
  plugins: [
    // MOCK_API=1 npx vite dev → 攔截 /api/* 返回假資料
    ...(process.env.MOCK_API ? [mockApiPlugin()] : []),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 不注入 vite-plugin-pwa 自動產生的 registerSW.js（它呼叫
      // navigator.serviceWorker.register('/sw.js') 但沒 .catch → Chrome Mobile
      // 無痕/儲存停用時 register reject 變 unhandled rejection 進 Sentry,
      // "Error: Rejected" culprit /registerSW.js）。改由 src/entries/main.tsx
      // 自行 register 並 .catch（SW 是 enhancement，reject 靜默吞）。
      injectRegister: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Bypass browserslist file detection (there is a stray CLI script named
        // "browserslist" in the project root that confuses workbox-build).
        babelPresetEnvTargets: ['chrome >= 87', 'safari >= 14', 'firefox >= 78', 'edge >= 88'],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // 排除 Cloudflare Access 保護的頁面（未登入會被重定向，導致 precache 失敗）
        globIgnores: ['manage/**', 'admin/**'],
        // 關閉 navigation fallback — 避免 SW 攔截導航請求導致有網路時行為異常
        // SW 只做 precache 靜態資源 + runtime cache API，不干預頁面導航
        navigateFallback: null,
        runtimeCaching: [
          {
            // Production API — 只快取公開行程端點，排除 /api/permissions、/api/requests 等需認證的端點
            // v2.33.62 round 14c: 加 cacheWillUpdate 防 cross-user PII leak —
            // 只 cache 真正 anonymous + public response (request 沒帶 Cookie +
            // response Cache-Control 不含 private/no-store)。已 authenticated 走
            // network 但不寫入共用 SW cache，避免登出後下個 user 讀到上個 user PII。
            urlPattern: /^https:\/\/trip-planner-dby\.pages\.dev\/api\/trips\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              fetchOptions: { cache: 'no-cache' },
              plugins: [
                {
                  cacheWillUpdate: async ({ request, response }) => {
                    if (request.headers.get('Cookie')) return null;
                    const cc = response.headers.get('Cache-Control') ?? '';
                    if (cc.includes('private') || cc.includes('no-store')) return null;
                    return response;
                  },
                },
              ],
            },
            method: 'GET',
          },
          {
            // Dev proxy (localhost /api/trips/*) — 同上，只快取公開行程端點
            urlPattern: /^http:\/\/localhost:\d+\/api\/trips\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-dev',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              fetchOptions: { cache: 'no-cache' },
              plugins: [
                {
                  cacheWillUpdate: async ({ request, response }) => {
                    if (request.headers.get('Cookie')) return null;
                    const cc = response.headers.get('Cache-Control') ?? '';
                    if (cc.includes('private') || cc.includes('no-store')) return null;
                    return response;
                  },
                },
              ],
            },
            method: 'GET',
          },
        ],
      },
      manifest: false, // manifest.json already exists in public/
    }),
    ...sentryPlugins,
  ],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/@sentry')) return 'sentry';
          // v2.33.60 round 14: heavy deps 各自 chunk，避免 lazy-route load 拖整 sibling
          if (id.includes('node_modules/@googlemaps/')) return 'gmaps';
          if (id.includes('node_modules/@headlessui/')) return 'headlessui';
          if (id.includes('node_modules/@dnd-kit/')) return 'dndkit';
          if (id.includes('node_modules/react-day-picker') || id.includes('node_modules/date-fns/')) return 'datepicker';
          if (id.includes('node_modules/marked/')) return 'marked';
          if (id.includes('node_modules/html2pdf') || id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // v2.33.60 round 14: 拔 optimizeDeps['leaflet'] — v2.23.0 已切 Google Maps，
  // leaflet 不在 package.json，留著會 trigger Vite dev startup warning。
  server: {
    proxy: process.env.MOCK_API ? {} : {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
    watch: {
      // Exclude wrangler state — its SQLite WAL writes trigger spurious HMR reloads
      ignored: ['**/.wrangler/**'],
    },
  },
});
