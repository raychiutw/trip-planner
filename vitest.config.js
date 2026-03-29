import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup-jest-dom.js'],
    environment: 'jsdom',
    exclude: ['tests/e2e/**', 'tests/api/**', 'node_modules/**', 'server/node_modules/**', '.claude/**'],
  },
});
