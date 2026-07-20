import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { mockApiPlugin } from './scripts/vite-mock-api';
// 版本 / commit 單一來源 —— vitest.config.js 也 import 同一份，見該檔註解。
import { appVersion, commitSha, versionDefine } from './scripts/app-version.mjs';

// Only upload source maps to Sentry in CI (when SENTRY_AUTH_TOKEN is present).
// B-P6 task 10.1：mark release with package version + commit SHA。
// CI（GitHub Actions）有 GITHUB_SHA env；fallback 到 explicit SENTRY_RELEASE 或 'local'。
const sentryRelease =
  process.env.SENTRY_RELEASE || `tripline@${appVersion}-${commitSha}`;

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
  // 注入給前端顯示（帳號頁版本頁尾）。與 sentryRelease 同源，見上方註解。
  define: versionDefine,
  plugins: [
    // MOCK_API=1 npx vite dev → 攔截 /api/* 返回假資料
    ...(process.env.MOCK_API ? [mockApiPlugin()] : []),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
    // Expected largest async chunk: PDF export. It is only loaded after the user
    // clicks export, and the html2pdf source alias below keeps it split away
    // from the initial route bundles. Keep the limit narrow enough to catch
    // future PDF growth while avoiding the old 500 kB false alarm.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (moduleId.includes('node_modules/react-dom') || moduleId.includes('node_modules/react/') || moduleId.includes('node_modules/react-router')) return 'vendor';
          if (moduleId.includes('node_modules/@sentry')) return 'sentry';
          // v2.33.60 round 14: heavy deps 各自 chunk，避免 lazy-route load 拖整 sibling
          if (moduleId.includes('node_modules/@googlemaps/')) return 'gmaps';
          if (moduleId.includes('node_modules/@headlessui/')) return 'headlessui';
          if (moduleId.includes('node_modules/@dnd-kit/')) return 'dndkit';
          if (moduleId.includes('node_modules/react-day-picker') || moduleId.includes('node_modules/date-fns/')) return 'datepicker';
          if (moduleId.includes('node_modules/marked/')) return 'marked';
          if (moduleId.includes('node_modules/html2pdf.js/src/')) return 'pdf';
          if (moduleId.includes('node_modules/jspdf/')) return 'pdf-jspdf';
          if (moduleId.includes('node_modules/html2canvas/')) return 'pdf-html2canvas';
          if (moduleId.includes('node_modules/dompurify/')) return 'pdf-dompurify';
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      // The package default points at a pre-bundled UMD build, which forces the
      // whole PDF exporter into one async chunk. Use the source entry so Rollup
      // can split html2canvas / jsPDF / DOMPurify into their own lazy chunks.
      { find: 'html2pdf.js', replacement: resolve(__dirname, 'node_modules/html2pdf.js/src/index.js') },
    ],
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
