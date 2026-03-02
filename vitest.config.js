import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.js'],
    environment: 'jsdom',
    exclude: ['tests/e2e/**', 'node_modules/**', '.claude/**'],
  },
});
