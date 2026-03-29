import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/api/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
  },
});
