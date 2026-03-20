import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
  plugins: [tailwindcss(), react(), ...sentryPlugins],
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
