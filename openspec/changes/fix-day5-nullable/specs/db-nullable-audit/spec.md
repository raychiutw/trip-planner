## ADDED Requirements

### Requirement: Day 5 date 資料修正
系統 SHALL 透過 migration 將 Day 5 的 `date` 欄位修正為正確日期值（根據同 trip 其他天的日期推算）。

#### Scenario: Day 5 date 從 NULL 修正為正確日期
- **WHEN** migration 執行完成
- **THEN** `days` 表中所有 `date` 為 NULL 的記錄 SHALL 被填入正確日期值
- **THEN** DayNav pill SHALL 顯示 `M/D` 格式而非 `day_num`

### Requirement: nullable 欄位盤點與 NOT NULL 約束
系統 SHALL 對以下欄位強制 NOT NULL 約束：

**days 表**（backfill + API 驗證）：
- `date` — NOT NULL（必填，YYYY-MM-DD）
- `day_of_week` — NOT NULL（必填）
- `label` — NOT NULL（必填，≤8 字）

**entries 表**（backfill + API 驗證）：
- `title` — 已 NOT NULL ✅
- `sort_order` — 已 NOT NULL ✅

**restaurants 表**（可 recreate）：
- `name` — 已 NOT NULL ✅
- `sort_order` — SHALL 加 NOT NULL DEFAULT 0

**shopping 表**（可 recreate）：
- `name` — 已 NOT NULL ✅
- `sort_order` — SHALL 加 NOT NULL DEFAULT 0

#### Scenario: 被 FK 引用的表 backfill NULL 值
- **WHEN** migration 執行 backfill SQL
- **THEN** `days` 表中 `date`、`day_of_week`、`label` 的 NULL 值 SHALL 被填入合理預設值
- **THEN** 填入後查詢 `SELECT COUNT(*) FROM days WHERE date IS NULL` SHALL 回傳 0

#### Scenario: 安全表 recreate 加 NOT NULL
- **WHEN** migration 對 `restaurants` 和 `shopping` 執行 recreate
- **THEN** `sort_order` 欄位 SHALL 有 `NOT NULL DEFAULT 0` 約束
- **THEN** 所有現有資料 SHALL 完整保留（recreate 前後 row count 相同）

### Requirement: Migration 前必須備份
系統 SHALL 在執行任何 schema 變更 migration 前，先執行 `node scripts/dump-d1.js` 產出備份快照。

#### Scenario: 備份產出
- **WHEN** 準備執行 migration
- **THEN** `backups/{timestamp}/` 目錄 SHALL 包含所有表的 JSON dump
- **THEN** 備份檔 SHALL 納入版控

### Requirement: API 層必填驗證擴展
系統 SHALL 擴展 `_validate.ts`，新增 `validateEntryBody()` 和 `validateRestaurantBody()` 函式。

#### Scenario: entries PUT/PATCH 驗證必填欄位
- **WHEN** PUT 或 PATCH `/api/trips/:id/entries/:eid` 的 body 缺少 `title`
- **THEN** API SHALL 回傳 400 `{ error: "必填欄位缺失: title" }`

#### Scenario: restaurants POST 驗證必填欄位
- **WHEN** POST `/api/trips/:id/entries/:eid/restaurants` 的 body 缺少 `name`
- **THEN** API SHALL 回傳 400 `{ error: "必填欄位缺失: name" }`

#### Scenario: 合法請求通過驗證
- **WHEN** 請求包含所有必填欄位
- **THEN** 驗證函式 SHALL 回傳 `{ ok: true, status: 200 }`

### Requirement: 驗證函式可單元測試
所有 validate 函式 SHALL 為純函式（不依賴 DB 或 HTTP context），可直接在 Vitest 中 import 測試。

#### Scenario: validateEntryBody 單元測試
- **WHEN** 呼叫 `validateEntryBody({ title: '' })`
- **THEN** SHALL 回傳 `{ ok: false, status: 400, error: "必填欄位缺失: title" }`

#### Scenario: validateRestaurantBody 單元測試
- **WHEN** 呼叫 `validateRestaurantBody({ name: '拉麵店' })`
- **THEN** SHALL 回傳 `{ ok: true, status: 200 }`
