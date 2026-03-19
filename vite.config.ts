import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
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
