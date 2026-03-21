## Why

DayNav 第 5 天的 pill 顯示「5」而非「7/6」，原因是 DB 中 `days.date` 欄位為 NULL。`formatPillLabel()` 在 date 為空時退化顯示 `day_num`。Migration 0010 嘗試 backfill 但未涵蓋所有記錄，且 D1 不支援 `ALTER COLUMN SET NOT NULL`，導致 schema 層級無強制約束，API 層驗證也僅覆蓋 PUT days 端點。需要全面盤點 DB nullable 欄位，補上應有的 NOT NULL 約束，防止同類問題再發生。

## What Changes

- 修正現有 Day 5 的 `date` 資料（backfill 正確日期值）
- 盤點所有 DB 表的 nullable 欄位，識別應為 NOT NULL 的欄位
- 透過 recreate table 策略為關鍵欄位加上 NOT NULL + DEFAULT（需注意 CASCADE 風險，僅對無被 FK 引用的表使用 recreate；被引用的表只做 backfill + API 驗證）
- 強化 API 層 server-side 必填驗證（擴展 `_validate.ts`，涵蓋 entries / restaurants 等端點）
- **Migration 執行前必須先 `node scripts/dump-d1.js` 備份**

## Capabilities

### New Capabilities
- `db-nullable-audit`: 全面盤點 DB 表 nullable 欄位，建立 NOT NULL 約束策略（哪些用 DDL、哪些用 API 驗證），並實施修正

### Modified Capabilities
（無既有 spec 層級行為變更）

## Impact

- **DB migrations**：新增 migration（backfill NULL 值 + recreate 安全表）
- **API**：`functions/api/_validate.ts` 擴展，可能新增 `validateEntryBody()` 等函式
- **API handlers**：PUT/PATCH entries、POST restaurants 等端點加入驗證呼叫
- **測試**：`tests/unit/days-validation.test.ts` 擴展 + 新增 entry/restaurant 驗證測試
- **備份**：執行前產出 `backups/{timestamp}/` 快照
- **前端**：不需改動（修正資料後 DayNav 自動正常顯示）
