---
name: tp-daily-check
description: 每日健康檢查時使用 — 執行 daily-check.js，涵蓋 R0-R18、API 狀態、Sentry 錯誤，發送 Telegram 摘要（每日檢查、daily check、健康檢查）。單趟行程驗證用 /tp-check。
user-invocable: true
---

每日問題報告 — 執行 daily-check.js，讀取報告，發送 Telegram 摘要，等待 Key User 指示。

本 skill 由本機排程每天 06:13 在**互動模式**啟動，session 保持開著等待回覆。

## 步驟

1. 執行 `node scripts/daily-check.js` 產出問題報告 JSON
2. 讀取最新的 `scripts/logs/daily-check-*.json`
3. 整理成 Telegram 摘要（只含重點：🔴critical / 🟡warning / ✅ok）
4. 用 Telegram MCP reply 發送摘要給 Key User（chat_id: 6527604594）
5. **等待 Key User 在 Telegram 回覆**，根據回覆執行：
   - 「修 #1 #3」→ 讀 JSON 完整資料，分析問題，派工程師修復
   - 「看 #2 詳情」→ 讀 JSON 完整資料，發送該問題的詳細資訊
   - 「全部看」→ 發送完整報告
   - 「沒事」或「結束」→ 結束 session
6. 修復完成後：
   - commit（遵守團隊流程：Reviewer → QC → commit）
   - 發 Telegram 通知修復結果
   - 等 Key User approve → push

## 環境需求

- daily-check.js 需要環境變數：CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
- 這些變數應在排程環境中設定（`.env.local` 或 shell profile），或從 openspec/config.yaml 讀取

## 排程方式

macOS 排程（launchd / cron）每天 06:13 執行：
```bash
# 排程啟動 Claude 互動模式，由 session hook 觸發 /tp-daily-check
claude
```

手動觸發：直接在 Claude Code 中輸入 `/tp-daily-check`。
