## error-monitoring

### Requirements
1. 前端所有 ApiError（SYS_* 和 DATA_SAVE_FAILED）自動 Sentry.captureException + tag `error.category`
2. Sentry Alert 規則：SYS_* > 3 次/5 分鐘 → Telegram 通知
3. `scripts/daily-check.js` 加入資料異常偵測：
   - 空行程（trip 有 days 但 entries = 0）
   - POI 異常（name 為空、type 不在允許清單）
   - 連結格式（maps URL 格式檢查）
4. 異常 → Telegram 通知，不等使用者回報

### Acceptance Criteria
- SYS_INTERNAL 錯誤出現時 Sentry 收到 event
- daily-check 偵測到空行程時 Telegram 通知
