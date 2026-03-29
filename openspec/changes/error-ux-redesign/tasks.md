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

### Phase 3: 消除靜默失敗（部分完成）
- [ ] T3.1: `src/hooks/useTrip.ts` — day 載入失敗 → ErrorPlaceholder + Toast（依嚴重度）
- [ ] T3.2: `src/hooks/useTrip.ts` — doc 載入失敗 → ErrorPlaceholder（輕微，不跳 Toast）
- [x] T3.3: `functions/api/*.ts` — 所有 13 個 handler 改用 `throw new AppError('CODE')`
- [ ] T3.4: 移除所有英文錯誤訊息，100% 繁體中文

### Phase 4: 一鍵回報
- [ ] T4.1: D1 migration — CREATE TABLE error_reports
- [ ] T4.2: `functions/api/reports.ts` — POST 端點（公開、驗證 tripId、蜜罐、D1 + Telegram）
- [ ] T4.3: ReportButton 接入 ErrorPlaceholder（已內嵌，需接 API）
- [ ] T4.4: 離線暫存（已實作 savePendingReport + flushPendingReports，需接入 app 入口）

### Phase 5: 監控
- [ ] T5.1: Sentry 強化 — ApiError 自動上報 + error.category tag
- [ ] T5.2: `scripts/daily-check.js` — 加資料異常偵測規則（空行程、POI 異常、連結格式）
- [ ] T5.3: Telegram 通知整合（SYS_* alert + 使用者回報轉發 + daily-check 異常）

### 測試
- [x] T6.1: unit — ApiError 解析（新格式 / 舊格式 / TypeError / timeout）
- [x] T6.2: unit — 錯誤碼 → severity mapping
- [x] T6.3: unit — Toast 堆疊 + 自動消失
- [ ] T6.4: unit — useTrip 失敗不再靜默
- [ ] T6.5: unit — 離線暫存 + 上線送出
- [ ] T6.6: integration — POST /api/reports（成功 / tripId 不存在 / rate limit）
