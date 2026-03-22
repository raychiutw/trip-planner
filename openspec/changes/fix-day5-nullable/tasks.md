## 1. 備份

- [x] 1.1 執行 `node scripts/dump-d1.js` 產出 D1 備份快照至 `backups/2026-03-21T19-02-38/`

## 2. Migration — backfill NULL 值

- [x] 2.1 查詢現有 days 表資料，確認 Day 5 的正確日期（根據同 trip 其他天推算）
- [x] 2.2 撰寫 migration `0011_backfill_nulls.sql`：backfill `days.date`、`days.day_of_week`、`days.label` 的 NULL 值
- [x] 2.3 撰寫 migration `0012_recreate_safe_tables.sql`：recreate `restaurants` 和 `shopping` 表，`sort_order` 加 NOT NULL DEFAULT 0

## 3. API 驗證擴展

- [x] 3.1 在 `_validate.ts` 新增 `validateEntryBody()` — 驗證 `title` 必填
- [x] 3.2 在 `_validate.ts` 新增 `validateRestaurantBody()` — 驗證 `name` 必填
- [x] 3.3 在 `entries/[eid].ts` 的 PATCH handler 加入 `validateEntryBody()` 呼叫
- [x] 3.4 在 `entries/[eid]/restaurants.ts` 的 POST handler 加入 `validateRestaurantBody()` 呼叫
- [x] 3.5 在 `restaurants/[rid].ts` 的 PATCH handler 加入 `validateRestaurantBody()` 呼叫

## 4. 測試

- [x] 4.1 新增 `tests/unit/entry-validation.test.ts` — 測試 `validateEntryBody()` 各種 case
- [x] 4.2 新增 `tests/unit/restaurant-validation.test.ts` — 測試 `validateRestaurantBody()` 各種 case
- [x] 4.3 執行 `npx tsc --noEmit` + `npm test` 確認全過

## 5. 驗證

- [x] 5.1 執行 migration 到 remote D1，確認 0010-0012 已 applied
- [x] 5.2 確認 DayNav Day 5 pill 顯示正確日期格式（Key User 驗證通過）
