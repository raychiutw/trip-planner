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
          /*
           * 2026-07-26：從 vitest 預設的 5s 提高。這個 project 裡有兩類**會 spawn 真子程序**的
           * 測試，它們在機器吃緊時（例如同時在跑 playwright）會超過 5s 而變成間歇失敗：
           *   - 12 個檔用 `createTestDb()` 起 Miniflare／workerd（`account-erasure`、
           *     `migration-00xx-*`…）—— 同一套 Miniflare 在 `vitest.config.api.mts` 早就設了
           *     testTimeout 90s，只有這個 project 還在吃 5s 預設
           *   - `check-migration-safety.test.ts` 每個 case 建一個真 git repo（6+ 個 git 子程序）
           *
           * 實測（機器空閒）：這兩支每個 case 300–600ms。**兩支各自間歇失敗的那條，都正好是
           * 該檔最慢的之一** —— 10 核吃滿時 10 倍慢就撞 5s。
           *
           * 純邏輯／source-grep 測試（本 project 的多數）都是毫秒級，提高上限對它們沒有成本：
           * 只有「真的卡死」時才會從 5s 變成 30s 才報。
           */
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
