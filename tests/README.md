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

1. **137 source-grep test → behaviour test** — 44% unit suite 是 readFileSync
   + regex match `src/`。Refactor-hostile + 不測 user behavior。重做需逐檔評估
   是否真有對應 behavior 可測。
2. **vitest workspace split (.ts vs .tsx)** — 估計 30-50% local `npm test` 提速。
   83 個 source-grep test 跑在 jsdom (unnecessary)。
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
npm test                 # vitest unit/integration (~4s)
npm run test:api         # miniflare API integration
npm run test:all         # = npm test + npm run test:api
npm run test:e2e         # playwright
npm test -- --run <file> # single file rerun (for flaky debug)
```

## vitest config

- `clearMocks: true` + `restoreMocks: true` (v2.33.65) — 自動 reset mock state
  between every `it()`。271 unit test 略 afterEach 仍 safe。
- `environment: 'jsdom'` — 全 unit test 預設 jsdom (待 workspace split)
- `setupFiles: ['./tests/setup-dom.js']` — `@testing-library/jest-dom` matchers
  + ResizeObserver / matchMedia / localStorage polyfill

## playwright config

- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 2 : 1`
- `webServer: npm run build && vite preview --port 3000`
