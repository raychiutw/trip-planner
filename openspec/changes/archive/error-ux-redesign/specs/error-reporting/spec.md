## error-reporting

### Requirements
1. `src/components/shared/ReportButton.tsx`：收集 context（URL, tripId, dayNum, errorCode, UA, timestamp）→ POST /api/reports
2. POST 成功 → Toast「已回報，我們會儘快處理」/ POST 失敗 → Toast「回報失敗，請稍後再試」
3. 離線時存 localStorage（key: `pendingReports`），上線事件觸發逐筆送出，上限 10 筆，超過丟最舊
4. `functions/api/reports.ts`（公開端點，不需認證）：驗證 tripId 存在 → INSERT error_reports → 發 Telegram
5. 防濫用：Cloudflare WAF IP rate limit（3 次/分）+ tripId 驗證 + 蜜罐欄位
6. D1 失敗 → 回 500 告知使用者 / Telegram 失敗 → 靜默
7. D1 migration：CREATE TABLE error_reports

### Acceptance Criteria
- ReportButton 在 ErrorPlaceholder 內可見可點擊
- 離線按回報 → 不報錯，上線後自動送出
- tripId 不存在 → 400
