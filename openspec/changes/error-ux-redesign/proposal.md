## Why

使用者遇到錯誤時唯一的解法是截圖傳給開發者。前端大量靜默失敗（day/doc 載入失敗不通知），API 有 ~70 個錯誤訊息中英混雜，`useApi` 丟失 response body。開發者是單點故障 — 離線時所有問題停擺。

已通過 office-hours + CEO + Eng + Design 四審。設計文件：`~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260329-120000.md`

## What Changes

- **統一 API 錯誤格式**：`{error: {code, message, detail}}`，AppError class + middleware throw/catch pattern
- **錯誤碼系統**：5 類 15 個代碼（NET/AUTH/PERM/DATA/SYS），共用 enum 在 `src/types/api.ts`
- **Toast 重寫**：頂部 iOS 風格滑入、可堆疊、3 秒消失、用 tokens.css color token
- **ErrorPlaceholder 元件**：原位顯示錯誤 + 「重新整理頁面」提示 + 內嵌 ReportButton
- **消除靜默失敗**：useTrip day/doc 載入失敗改顯示 ErrorPlaceholder + Toast
- **一鍵回報**：ReportButton 收集 context → POST /api/reports → D1 + Telegram
- **離線回報暫存**：localStorage 暫存（上限 10 筆），上線自動送出
- **Sentry 強化**：ApiError 自動上報 + error.category tag
- **daily-check 異常偵測**：空行程、POI 異常、連結格式
- **API 端點統一**：所有 ~20 個端點改用 AppError throw，100% 繁體中文訊息

## Capabilities

### New Capabilities
- `error-codes`: API 統一錯誤碼系統（AppError class + 錯誤碼 enum + middleware catch）
- `error-ui`: 前端錯誤 UI 元件（Toast 重寫 + ErrorPlaceholder + 嚴重度分層）
- `error-reporting`: 使用者一鍵回報機制（ReportButton + /api/reports + 離線暫存）
- `error-monitoring`: 主動錯誤監控（Sentry 強化 + daily-check 異常偵測 + Telegram）

### Modified Capabilities

（無現有 spec 需修改）

## Impact

**後端（functions/api/）：**
- `_errors.ts`（新增）、`_middleware.ts`（改 catch pattern）、`_types.ts`（加 AppError）
- 所有 ~20 個端點改用 AppError throw
- `reports.ts`（新端點，公開寫入）
- D1 migration：CREATE TABLE error_reports

**前端（src/）：**
- `types/api.ts`（加 ErrorCode enum）
- `lib/errors.ts`（新增 ApiError class + 分類引擎）
- `hooks/useApi.ts`（改：解析結構化錯誤 + NET_* 產生）
- `hooks/useTrip.ts`（改：消除靜默失敗）
- `components/shared/Toast.tsx`（重寫）
- `components/shared/ErrorPlaceholder.tsx`（新增）
- `components/shared/ReportButton.tsx`（新增）

**腳本：**
- `scripts/daily-check.js`（加資料異常偵測規則）

**部署**：同一個 PR，migration 先跑。向下相容 sniff（`typeof body.error === 'string'`）。
