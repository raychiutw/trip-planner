import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // v2.33.65 round 15: renamed from setup-jest-dom.js (project uses vitest, not Jest)
    setupFiles: ['./tests/setup-dom.js'],
    environment: 'jsdom',
    // v2.33.65 round 15: clearMocks + restoreMocks 自動 reset mock state between
    // every it() — 防 global.fetch = vi.fn() / vi.spyOn() 等 cross-test leak。
    // 271 unit test 略 afterEach 也仍能正常 reset。Vitest 4.1 idiom。
    clearMocks: true,
    restoreMocks: true,
    exclude: ['tests/e2e/**', 'tests/api/**', 'node_modules/**', 'server/node_modules/**', '.claude/**', '.agents/**', '.codex/**'],
  },
});
