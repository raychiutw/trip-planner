import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { swRuntimeCaching } from './scripts/sw-api-cache.mjs';
import { mockApiPlugin } from './scripts/vite-mock-api';
import { devApiProxy } from './scripts/dev-proxy.mjs';
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

/**
 * e2e／MOCK_API 專用：把 `src/lib/auth/index.ts` 換成穿透版（見 tests/e2e/_helpers/auth-passthrough.ts）。
 * 只有 `E2E_AUTH_PASSTHROUGH=1`（playwright 的建置指令）或 `MOCK_API`（本機假 api 開發）才啟用；正式建置沒有這個外掛。
 */
const authPassthrough = (): Plugin => ({
  name: 'auth-passthrough',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !/(^|\/)auth(\/index)?$/.test(source)) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved?.id.endsWith('/src/lib/auth/index.ts') ? resolve(__dirname, 'tests/e2e/_helpers/auth-passthrough.ts') : null;
  },
});

export default defineConfig(({ mode }) => {
// loadEnv 會合併 process.env 與 .env.<mode>；CI／本機皆適用
const apiBase = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL;
return {
  // 注入給前端顯示（帳號頁版本頁尾）。與 sentryRelease 同源，見上方註解。
  define: versionDefine,
  plugins: [
    // MOCK_API=1 npx vite dev → 攔截 /api/* 返回假資料
    ...(process.env.MOCK_API ? [mockApiPlugin()] : []),
    ...(process.env.MOCK_API || process.env.E2E_AUTH_PASSTHROUGH === '1' ? [authPassthrough()] : []),
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
        // 公開行程離線快取規則：見 scripts/sw-api-cache.mjs（網址取自 VITE_API_BASE_URL）
        runtimeCaching: swRuntimeCaching(apiBase),
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
    // 目標可用 DEV_API_PROXY_TARGET 改（見 CONTRIBUTING.md「本機開發」）
    proxy: process.env.MOCK_API ? {} : devApiProxy({ ...loadEnv(mode, process.cwd(), 'DEV_'), ...process.env }),
    watch: {
      // Exclude wrangler state — its SQLite WAL writes trigger spurious HMR reloads
      ignored: ['**/.wrangler/**'],
    },
  },
};
});
