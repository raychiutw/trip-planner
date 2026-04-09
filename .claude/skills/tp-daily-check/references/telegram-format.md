# Telegram 報告格式

## 有問題時

```
📊 Tripline 每日報告 04/08
──────────────
⚠️ Sentry: 3 筆
⚠️ API errors: 24 筆
⚠️ 未完成請求: 2 筆
🔧 自動修復: 3 項完成
🔨 Code fix: 1 PR merged, 1 需人工
──────────────
📈 Workers: 1,234 req | err 0.1% | P50 45ms P99 320ms
📈 Analytics: 89 visits, 234 views
📈 npm: 0 vulnerabilities
✅ OK: api-server, daily-check
```

## 全綠時

```
📊 04/08 ✅ 全綠
🔧 無需修復
📈 Workers: 1,234 req | err 0.1% | P50 45ms P99 320ms
📈 Analytics: 89 visits, 234 views
📈 npm: 0 vulnerabilities
```

## 自動修復範圍

### Phase A：資料修復

| 來源 | 可修復的錯誤 | 修復動作 |
|------|------------|---------|
| requestErrors | status = received/processing/failed | PATCH → open |
| api-server error log | process loop crash 後 request 卡住 | PATCH → open |
| daily-check error log | 上次修復失敗的項目 | 重試一次 |

### Phase B：Code Fix（走 tp-team pipeline）

| 來源 | 觸發條件 | 修復動作 |
|------|---------|---------|
| Sentry issues | 有明確 error + 可定位 source | fix branch → ship → deploy |
| API errors（自家 caller） | 非外部 API、非使用者操作錯誤 | 修正 caller code |
