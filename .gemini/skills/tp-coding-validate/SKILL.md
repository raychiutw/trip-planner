---
name: tp-coding-validate
description: 在 commit 前驗證命名規範與測試狀態。掃描 JS/CSS/HTML/API 命名，若有違規則修正直到全部通過。
---

# tp-coding-validate

Commit 前程式碼品質驗證。驗證命名規範 + 測試全過，紅燈則持續修改直到綠燈。

## 核心原則

- 自動修正命名違規，不問問題。
- 紅燈持續循環修正，直到 `npm test` 全過。

## 步驟

1. **執行測試**：`npm test`（包含 naming-convention.test.js 和全套 unit/integration 測試）
2. **全過** → 綠燈，可以 commit
3. **有失敗** → 紅燈：
   - 列出所有失敗的測試名稱和錯誤訊息
   - 根據錯誤類型自動修正（命名違規 → 參照下方規範修正；測試失敗 → 分析原因修正程式碼）
   - 重新跑 `npm test`
   - 重複直到全過

## 驗證項目

- JS 命名：函式 camelCase、常數 UPPER_SNAKE_CASE、可變狀態 camelCase（不得用 UPPER_CASE）
- CSS 命名：class kebab-case、custom property --kebab-case
- HTML 命名：element ID camelCase（靜態）、data-* kebab-case
- API 命名：trip identifier 統一用 tripId（非 id）
- DB→JS mapping：使用 mapRow 統一轉換
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
