# Tripline Tests

## Layout

```
tests/
├── unit/        vitest + jsdom — component / lib / source-grep guard
├── api/         vitest + miniflare — D1 integration test
├── e2e/         playwright — browser flow
├── setup-dom.js (v2.33.65: renamed from setup-jest-dom.js)
└── README.md   ← 本檔
```

## Naming convention

- `<topic>.test.ts(x)` — feature / component / module 行為測試
- `<topic>-snapshot.test.tsx` — snapshot (限 1-2 個檔，避免 brittle)
- `migration-NNNN-*.test.ts` — D1 migration shape / behavior
- `round-N[a-z]?-*.test.ts` — 跨 module review round 的 source-grep guard
  (v2.32+ convention)
- `v2_31_XX-*.test.ts` — **legacy** (v2.31.x file-per-bug regression pattern)
  — 不再新增，但既有 14 個檔保留作 history (見 Round 15 doc)

## 大型 deferred refactor (待 plan-eng-review)

### Round 15 finding 未做的:

1. **source-grep test → behaviour test** — **約半數** unit 測試檔是 readFileSync
   + regex match `src/`。Refactor-hostile + 不測 user behavior。重做需逐檔評估
   是否真有對應 behavior 可測。

   > **統計口徑**（可重算，別再寫死絕對數字）：分母 = `tests/unit/**/*.test.{ts,tsx,js}`；
   > 「source-grep」= 檔內出現 `readFileSync`；「純 source-grep」= 有 `readFileSync`
   > 但完全不碰 DOM（無 `render(`／`screen.`／`document.`／`@testing-library`）。
   > **2026-07-25 快照**：478 檔中 source-grep 237（**50%**），其中純的 219（**46%**）。
   > 比例是這條 finding 的論證前提 —— 重估前先用上面的口徑重算一次，別引用舊數字。

2. ~~**vitest workspace split (.ts vs .tsx)**~~ — **已完成，不再是 deferred 項**。
   `vitest.config.js` 現有 `projects: [unit-dom, unit-node]`：`*.test.ts` 走
   `environment: 'node'`（不載 jsdom / setup polyfill），`*.test.tsx`／`*.test.js`
   加上明列的 `TS_DOM_FILES` 走 jsdom。
   **殘留**：2026-07-25 實測仍有 **20 支「純 source-grep 卻跑在 jsdom」** —— 它們是
   `.tsx`／`.js` 副檔名（因此被 include 規則歸到 jsdom），但內容完全不碰 DOM。要收乾
   得改副檔名或把它們列進 node project 的 include，屬小額整理而非原本估的大型 refactor。
3. **shared mock factory `tests/unit/__factories__/`** — makeTrip / makeEntry /
   makeUser / renderWithProviders。防 v2.31.14/15/27 family camelCase drift bug。
4. **4 untested core pages** — CollabPage / TripLayout / AppearanceSettingsPage /
   NotificationsSettingsPage。Smoke render at minimum。
5. **25 untested API endpoint** — admin/maps-* / JWKS / openid-configuration /
   places/autocomplete / poi-search 等。Security-relevant，建議 200/401/403 status test。
6. **E2E mocks 959 LOC stale schema** — `tests/e2e/api-mocks.js` 含 v2.19.x 已 dropped
   field (googleRating / master object / travel legacy)。

### Round 16 finding 未做的:

- e2e workers / retries 改 CI 設定 (已 v2.33.65 部分 ship)。

## Test infra cmd

```bash
npm test                 # vitest unit/integration（本機約 80-90s，2026-07-25 快照）
npm run test:api         # miniflare API integration
npm run test:all         # = npm test + npm run test:api
npm run test:e2e         # playwright
npm test -- --run <file> # single file rerun (for flaky debug)
```

## vitest config

- `clearMocks: true` + `restoreMocks: true` (v2.33.65) — 自動 reset mock state
  between every `it()`，所以**整套 unit test 都可以省略 afterEach**（不必逐檔清）。
- `projects: [unit-dom, unit-node]` — **不是全套跑 jsdom**：`*.test.ts` 走
  `environment: 'node'`，`*.test.tsx`／`*.test.js` 與明列的 `TS_DOM_FILES` 走 jsdom。
  改測試檔副檔名會連帶換掉它的執行環境，`document` 之類的全域可能就沒了。
- `setupFiles: ['./tests/setup-dom.js']` — `@testing-library/jest-dom` matchers
  + ResizeObserver / matchMedia / localStorage polyfill

## playwright config

- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 2 : 1`
- `webServer: npm run build && vite preview --port 3000`
