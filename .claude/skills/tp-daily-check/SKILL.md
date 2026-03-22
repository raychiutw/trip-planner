# tp-daily-check

每日問題報告 — 執行 daily-check.js 並讀取報告發送 Telegram。

## 步驟

1. 執行 `node scripts/daily-check.js`
2. 讀取最新的 `scripts/logs/daily-check-*.json`
3. 整理成 Telegram 摘要
4. 用 Telegram MCP 發送給 Key User（chat_id: 6527604594）
5. 等待 Key User 回覆要修哪些問題
