# Round 9 — src/lib zero-test catch-up (v2.33.53)

**日期**: 2026-05-24
**PR**: TBD (chore/v2.33.53-lib-test-catchup → master)
**Module**: `src/lib/`
**LOC**: 5 個無覆蓋率模組 → +52 test，0 production code change

## 背景

backlog #116 — 從 round 1/2/3 src/lib review 後尚未補測試的 6 個檔
中挑出 5 個有實際 logic 的補測。`sentry.ts` 純 init() 在 PROD only
無 testable surface，不補。

## 對象與覆蓋

| File | LOC | Coverage 策略 | New tests |
|------|-----|---------------|-----------|
| `src/lib/dayArtMapping.ts` | 118 | Behavioural (extractArtKeys) | 9 |
| `src/lib/mapRow.ts` | 52 | Behavioural (snakeToCamel + mapRow + mapRows) | 9 |
| `src/lib/constants.ts` | 51 | Behavioural (SAFE_COLOR_RE + safeColor + getLocalToday) | 16 |
| `src/lib/docKeys.ts` | 15 | Contract + cross-file sync | 4 |
| `src/lib/tripExport.ts` | 301 | Source-grep (private helpers) | 14 |

**Total**: 52 new tests, all passing.

## 為何 tripExport.ts 走 source-grep

`safeFileBase` / `csvSafe` 是 module-private（v2.33.36 security audit
round 1 加的），暴露 export 純為測試會弄髒 production API。改用
source-grep 鎖死 mitigation regex + 行為 marker 不被回退：

- `safeFileBase` strip 控制字元 + windows 保留字 + 80 char limit + 'trip' fallback
- `csvSafe` 偵測 `=+-@\t\r` 開頭 + 單引號 prefix
- catch 區塊 `console.error('[downloadTripFormat]', err)` 不再吞錯
- CSV `﻿` BOM + 17-column schema (v2 R19) headers

## docKeys cross-file 對齊

`tests/unit/docKeys.test.ts` 讀 `functions/api/trips/[id]/docs/[type].ts`
source，斷言 5 個 DOC_KEYS 都在 backend `VALID_TYPES` 中出現。
未來 frontend/backend 不同步加 doc type → fail。

## mapRow snakeToCamel quirk

`/_([a-z])/g` regex 對 leading `_foo` 也 match（`_f` → `F`），所以
`snakeToCamel('_foo') === 'Foo'`。實務上 D1 cols 從不以 `_` 開頭，
不會撞到，但 test 記錄此 behaviour 防未來 refactor 偏離。

## Status

- ✅ 52 個新 test 全綠
- ✅ tsc clean（無 production code 改動）
- ✅ 全 suite 2380/2380 全綠（從 2328 +52）
- 🔄 sentry.ts skip（無 testable surface）
- 🔄 backlog #117 src/lib runtime reverse imports 留下輪
