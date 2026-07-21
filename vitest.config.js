import { defineConfig } from 'vitest/config';
// vite.config.ts 的 define **不會**自動套到 vitest —— 兩份設定是獨立的。
// 少了這行，任何 render __APP_VERSION__ 的 component 在測試裡會 ReferenceError。
import { versionDefine } from './scripts/app-version.mjs';

/**
 * v2.33.71 round 21: projects split — dom vs node 環境分流。
 *
 * Round 15 finding: 197/210 .test.ts 不需 jsdom (pure source-grep / unit logic)，
 * 跑 node env 30-50% 更快。100 .test.tsx + 9 .test.js + 5 真用 DOM 的 .test.ts
 * 留 jsdom project。
 *
 * 切回單 project: 移除 `projects:` 區塊 + 還原 `environment: 'jsdom'`.
 */
// .test.ts 真實依賴 jsdom (localStorage / window / document / TypeError 等
// browser-only globals)。Empirical list — fail-then-add 後得出。
const TS_DOM_FILES = [
  'tests/unit/trip-page-sheet-default.test.ts',
  'tests/unit/use-places-autocomplete.test.ts',
  'tests/unit/use-route.test.ts',
  'tests/unit/use-map-data.test.ts',
  'tests/unit/online-status.test.ts',
  'tests/unit/api-error.test.ts',
  'tests/unit/error-placeholder.test.ts',
  'tests/unit/local-storage-shape.test.ts',
  'tests/unit/trip-view-state.test.ts',
  'tests/unit/sanitize-uri-attrs.test.ts',
  'tests/unit/scroll-spy.test.ts',
  'tests/unit/v2_31_79-marker-label-text-outline.test.ts',
];

export default defineConfig({
  define: versionDefine,
  test: {
    globals: true,
    // v2.33.65 round 15: clearMocks + restoreMocks 自動 reset mock state
    // 防 global.fetch / vi.spyOn 等 cross-test leak。
    clearMocks: true,
    restoreMocks: true,
    // Windows + jsdom tests can over-saturate process startup and hit Vitest's
    // per-test timeout even when each file passes alone. Keep Linux/macOS CI at
    // default parallelism, but cap local Windows workers for deterministic runs.
    ...(process.platform === 'win32' ? { maxWorkers: 4 } : {}),
    exclude: ['tests/e2e/**', 'tests/api/**', 'node_modules/**', 'server/node_modules/**', '.claude/**', '.agents/**', '.codex/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-dom',
          include: [
            'tests/unit/**/*.test.tsx',
            'tests/unit/**/*.test.js',
            ...TS_DOM_FILES,
          ],
          environment: 'jsdom',
          // v2.33.65: renamed from setup-jest-dom.js
          setupFiles: ['./tests/setup-dom.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-node',
          include: ['tests/unit/**/*.test.ts'],
          exclude: TS_DOM_FILES,
          environment: 'node',
          // 不需 jsdom polyfill setup
        },
      },
    ],
  },
});
