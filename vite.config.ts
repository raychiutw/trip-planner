import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

// Only upload source maps to Sentry in CI (when SENTRY_AUTH_TOKEN is present).
const sentryPlugins = process.env.SENTRY_AUTH_TOKEN
  ? [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
    ]
  : [];

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Bypass browserslist file detection (there is a stray CLI script named
        // "browserslist" in the project root that confuses workbox-build).
        babelPresetEnvTargets: ['chrome >= 87', 'safari >= 14', 'firefox >= 78', 'edge >= 88'],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // 排除 Cloudflare Access 保護的頁面（未登入會被重定向，導致 precache 失敗）
        globIgnores: ['manage/**', 'admin/**'],
        runtimeCaching: [
          {
            // Production API — 只快取公開行程端點，排除 /api/permissions、/api/requests 等需認證的端點
            urlPattern: /^https:\/\/trip-planner-dby\.pages\.dev\/api\/trips\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 3,
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
              networkTimeoutSeconds: 3,
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
      input: {
        main: resolve(__dirname, 'index.html'),
        setting: resolve(__dirname, 'setting.html'),
        manage: resolve(__dirname, 'manage/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://trip-planner-dby.pages.dev',
        changeOrigin: true,
      },
    },
  },
});
