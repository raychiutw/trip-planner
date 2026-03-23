## Context

`days` 表的 `date`、`day_of_week`、`label` 欄位在 migration 0002 中定義為 nullable `TEXT`。Migration 0010 嘗試 backfill NULL → 空字串，但：
1. D1 不支援 `ALTER COLUMN SET NOT NULL`
2. Backfill 可能未涵蓋所有記錄（Day 5 仍為 NULL）
3. 僅 `_validate.ts` 的 `validateDayBody()` 攔截 PUT days，其他寫入端點無驗證

結果：Day 5 `date` 為 NULL → `formatPillLabel()` fallback 顯示 `day_num` = "5"。

同時，其他表也有類似問題：`entries.time`、`hotels.checkout` 等可能被寫入 NULL 但語意上不應允許。

## Goals / Non-Goals

**Goals:**
- 修正 Day 5 的 `date` 值為正確日期
- 盤點所有 DB 表 nullable 欄位，確認哪些應為 NOT NULL
- 對「安全可 recreate 的表」加上 DDL 層級 NOT NULL
- 對「被 FK 引用不可 recreate 的表」用 backfill + API 驗證雙重保護
- 擴展 `_validate.ts` 涵蓋 entries、restaurants 等端點

**Non-Goals:**
- 不改前端程式碼（修正資料即可）
- 不重構 API handler 架構（只加驗證）
- 不處理非 nullable 相關的 API 問題（H1-H4 屬後續 change）

## Decisions

### D1. 表分類策略：recreate vs backfill-only

| 分類 | 表 | 策略 | 原因 |
|------|-----|------|------|
| **被 FK 引用** | `trips`、`days`、`entries` | backfill + API 驗證 | DROP TABLE 觸發 CASCADE 刪除子表資料 |
| **未被 FK 引用** | `shopping`、`restaurants`（注意：restaurants 有 FK 引用自 entries，但本身不被其他表引用） | 可 recreate | 安全，不會連鎖刪除 |
| **不動** | `audit_log`、`api_logs`、`permissions`、`trip_docs` | 維持現狀 | 已有足夠約束或 nullable 合理 |

**替代方案考慮**：全部用 API 驗證不改 schema → 否決，因為 wrangler CLI 直接 INSERT 仍可寫入 NULL。

### D2. backfill 策略

- `days.date` NULL → 根據同 trip 的其他天日期推算（day_num 差值）
- 其他 NULL 欄位 → 合理 DEFAULT 值（空字串或 'unknown'）
- backfill SQL 在 migration 檔案中執行

### D3. API 驗證擴展

現有：`validateDayBody()` 驗證 `date`、`dayOfWeek`、`label`

新增：
- `validateEntryBody(body)` — 驗證 `title`（必填）、`time`（格式檢查）
- `validateRestaurantBody(body)` — 驗證 `name`（必填）

模式：每個 validate 函式回傳 `{ ok, status, error }` 一致介面。

### D4. Migration 執行順序

1. `node scripts/dump-d1.js` 備份
2. 執行 backfill migration（修正 NULL 值）
3. 執行 recreate migration（僅安全表）
4. 部署新 API 驗證碼
5. 驗證：查詢所有表確認無 NULL 值

## Risks / Trade-offs

- **[Risk] recreate table 期間短暫不可用** → Mitigation：D1 的 batch 操作是 atomic，recreate 步驟在單次 migration 中完成
- **[Risk] backfill 推算日期可能不準** → Mitigation：先查詢現有資料確認，migration 中加 comment 標記推算邏輯
- **[Risk] 現有 API 呼叫端可能未帶必填欄位** → Mitigation：只對新增/修改端點加驗證，GET 不受影響；tp-* skills 已有完整欄位
- **[Risk] D1 migration 失敗** → Mitigation：執行前備份 + D1 Time Travel 可還原
