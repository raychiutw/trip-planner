## Tasks

### Phase 1: 錯誤碼統一（基礎）✅
- [x] T1.1: `src/types/api.ts` — 新增 ErrorCode enum（16 個代碼）
- [x] T1.2: `functions/api/_errors.ts` — 新增 AppError class + ERROR_MAP + errorResponse helper
- [x] T1.3: `functions/api/_middleware.ts` — catch block 改 instanceof AppError 判斷
- [x] T1.4: `src/lib/errors.ts` — 新增 ApiError class + 錯誤分類引擎 + severity mapping
- [x] T1.5: `src/hooks/useApi.ts` — 改造：解析結構化錯誤 body + NET_* 產生 + 向下相容 sniff

### Phase 2: 錯誤 UI 元件 ✅
- [x] T2.1: `src/components/shared/Toast.tsx` — 重寫：頂部 iOS 風格、堆疊、3 秒消失、tokens.css color、aria
- [x] T2.2: `src/components/shared/ErrorPlaceholder.tsx` — 新增：原位錯誤提示 + 重新整理文字
- [x] T2.3: ReportButton 內嵌於 ErrorPlaceholder — 收集 context + POST + 離線暫存

### Phase 3: 消除靜默失敗 ✅
- [x] T3.1: `src/hooks/useTrip.ts` — day 載入失敗 → showErrorToast（依嚴重度）
- [x] T3.2: `src/hooks/useTrip.ts` — doc 載入失敗 → 輕微不跳 Toast，嚴重才跳
- [x] T3.3: `functions/api/*.ts` — 所有 13 個 handler 改用 `throw new AppError('CODE')`
- [x] T3.4: 移除所有英文錯誤訊息，100% 繁體中文（22 處）

### Phase 4: 一鍵回報 ✅
- [x] T4.1: D1 migration 0017 — CREATE TABLE error_reports
- [x] T4.2: `functions/api/reports.ts` — POST 端點（公開 + 蜜罐 + 30s rate limit）
- [x] T4.3: ReportButton 已內嵌 ErrorPlaceholder，POST /api/reports 已接入
- [x] T4.4: 離線暫存 savePendingReport + flushPendingReports 接入 main.tsx

### Phase 5: 監控 ✅
- [x] T5.1: Sentry 強化 — SYS_* 自動上報 + errorCode tag + category extra
- [x] T5.2: `scripts/daily-report.js` — 加資料異常偵測（空行程、孤立 POI、錯誤回報、缺 rating）
- [x] T5.3: Telegram 通知整合（異常時自動發送，需設定 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID）

### 測試 ✅
- [x] T6.1: unit — ApiError 解析（新格式 / 舊格式 / TypeError / timeout）— api-error.test.ts
- [x] T6.2: unit — 錯誤碼 → severity mapping — api-error.test.ts
- [x] T6.3: unit — Toast 堆疊 + 自動消失 — toast.test.tsx
- [x] T6.4: unit — useTrip 失敗觸發 Toast — use-trip-error.test.ts
- [x] T6.5: unit — 離線暫存 + 上線送出 — error-placeholder.test.ts
- [x] T6.6: integration — POST /api/reports — reports.integration.test.ts
