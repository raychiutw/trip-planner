---
name: tp-daily-check
description: 每日健康檢查時使用 — 讀取 daily-check report JSON，執行自動修復，發送精簡 Telegram 摘要（每日檢查、daily check、健康檢查）。單趟行程驗證用 /tp-check。
user-invocable: true
---

每日健康報告 — 讀取 report JSON，自動修復可修項目，發送精簡 Telegram 摘要。

本 skill 由 `daily-check-scheduler.sh` 在 Phase 2 呼叫（Phase 1 已執行 daily-check.js 產出 JSON）。

## 步驟

1. 讀取最新的 `scripts/logs/daily-check/YYYY-MM-DD-report.json`
2. 判斷可自動修復的項目：
   - tp-request error log 中 status 卡在 received/processing → PATCH → open
   - api-server error log 中 request 卡住 → PATCH → open
   - daily-check error log 中上次修復失敗 → 重試一次
3. 執行自動修復（API 呼叫）
4. 組裝精簡 Telegram 訊息（10-15 行）：
   - 🔴/⚠️ 只顯示總筆數
   - 🔧 自動修復只顯示完成項數
   - 📈 Workers / Analytics / npm 固定顯示數據
   - ✅ OK 項目合併一行
   - 全綠：`📊 MM/DD ✅ 全綠`
5. 用 Telegram MCP 發送摘要給 Key User（chat_id: 6527604594）
6. 結束（全自動，不等待回覆）

## Telegram 格式

有問題時：
```
📊 Tripline 每日報告 04/08
──────────────
🔴 API errors: 12 筆
⚠️ Sentry: 3 筆
⚠️ 排程錯誤: tp-request 2 筆
🔧 自動修復: 3 項完成
──────────────
📈 Workers: 1,234 req | err 0.1% | P50 45ms P99 320ms
📈 Analytics: 89 visits, 234 views
📈 npm: 0 vulnerabilities
✅ OK: api-server, daily-check
```

全綠時：
```
📊 04/08 ✅ 全綠
📈 Workers: 1,234 req | err 0.1% | P50 45ms P99 320ms
📈 Analytics: 89 visits, 234 views
📈 npm: 0 vulnerabilities
```

## 自動修復範圍

| 來源 | 可修復的錯誤 | 修復動作 |
|------|------------|---------|
| tp-request | status 卡在 received/processing | PATCH → open |
| api-server | process loop crash 後 request 卡住 | PATCH 卡住的 request → open |
| daily-check | 上次修復失敗的項目 | 重試一次 |

## 環境需求

- report JSON 由 `daily-check-scheduler.sh` Phase 1 產出
- Telegram 需要 MCP 連線

## 排程方式

`daily-check-scheduler.sh`（cron 06:13）自動呼叫。手動觸發：直接在 Claude Code 中輸入 `/tp-daily-check`。
