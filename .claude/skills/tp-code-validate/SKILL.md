---
name: tp-code-validate
description: Use before committing code changes to validate naming conventions, coding standards, and test green status. Runs validation loop until all checks pass.
user-invocable: true
---

Commit 前程式碼品質驗證。驗證命名規範 + 測試全過，紅燈則持續修改直到綠燈。

## 步驟

1. 執行 `npm test` — 包含 naming-convention.test.js 和所有 unit/integration 測試
2. 若全過 → 綠燈，可以 commit
3. 若有失敗 → 紅燈：
   a. 列出所有失敗的測試名稱和錯誤訊息
   b. 根據錯誤類型自動修正：
      - 命名違規：根據 `openspec/config.yaml` naming 規範修正
      - 測試失敗：分析原因並修正程式碼
   c. 重新跑 `npm test`
   d. 重複直到全過

## 驗證項目

- JS 命名：函式 camelCase、常數 UPPER_SNAKE_CASE、可變狀態 camelCase
- CSS 命名：class kebab-case、custom property --kebab-case
- HTML 命名：element ID camelCase（靜態）、data-* kebab-case
- API 命名：trip identifier 統一用 tripId（非 id）
- DB→JS mapping：使用 mapRow 統一轉換，不散寫 if(x) y = x
- 全部 unit/integration 測試通過

## 命名規範速查（來自 openspec/config.yaml）

| 情境 | 規範 | 範例 |
|------|------|------|
| JS 函式 | camelCase | `renderHotel`, `mapApiDay` |
| JS 本地變數 | camelCase | `tripId`, `currentConfig` |
| JS 真常數 | UPPER_SNAKE_CASE | `DRIVING_WARN_MINUTES`, `TRANSPORT_TYPES` |
| JS 可變狀態 | camelCase | `trip`, `currentTripId`（不得用 UPPER_CASE） |
| CSS class | kebab-case | `day-header`, `tl-event` |
| CSS custom property | --kebab-case | `--fs-body`, `--radius-md` |
| HTML 靜態 ID | camelCase | `stickyNav`, `tripContent` |
| HTML 動態 ID（JS 產生） | kebab-case | `day-slot-1`, `hourly-3` |
| HTML data 屬性 | kebab-case | `data-trip-id`, `data-day` |
| API DB 欄位 | snake_case | `trip_id`, `day_num` |
| API trip identifier | tripId | SELECT `id AS tripId` |
