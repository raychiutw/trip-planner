---
name: tp-daily-check
description: 每日健康檢查時使用 — 讀取 daily-check report JSON，執行自動修復，發送精簡 Telegram 摘要（每日檢查、daily check、健康檢查）。單趟行程驗證用 /tp-check。
user-invocable: true
---

每日健康報告 — 讀取 report JSON，自動修復可修項目，code issues 走 tp-team pipeline 自動修，發送精簡 Telegram 摘要。

本 skill 由 `daily-check-scheduler.sh` 在 Phase 2 呼叫（Phase 1 已執行 daily-check.js 產出 JSON）。

## 步驟

1. 讀取最新的 `scripts/logs/daily-check/YYYY-MM-DD-report.json`
2. **Phase A：資料修復**（API 呼叫，秒級完成）
   - request status 卡在 received/processing/failed → PATCH → open
   - api-server error log 中 request 卡住 → PATCH → open
   - daily-check error log 中上次修復失敗 → 重試一次
3. **Phase B：Code Fix**（走 tp-team pipeline，分鐘級）— **不可跳過**
   - 對報告中每個 warning/critical issue，必須執行以下 checklist：
     ```
     □ grep error message / API path → 找到 source file
     □ 讀取 source file，分析根因
     □ 判定：可修 → 開 fix branch 修  |  真的不可修 → 附上 grep 結果證明
     ```
   - **「0 users」「超過 7 天」「非 code bug」不是跳過的理由** — 只要 Sentry 有 unresolved issue 就嘗試修
   - **API 4xx 必須 grep 呼叫端** — 查是哪個 script/skill 發的，auth header 有沒有帶對
   - 對每個可修 issue：`claude -p` 開新 session → fix branch → `/tp-code-verify` → `/ship` → `/land-and-deploy`
   - 修不了的必須附上「嘗試了什麼 + grep 結果 + 為什麼修不了」
4. 將修復結果寫入 `scripts/logs/daily-check/YYYY-MM-DD-fix-result.json`：
   ```json
   {
     "total": 3, "fixed": 2, "failed": 1,
     "pr_url": "https://github.com/.../pull/160",
     "details": [
       {"status": "fixed", "summary": "ManagePage SSE infinite loop"},
       {"status": "fixed", "summary": "InfoBox render object as child"},
       {"status": "skipped", "summary": "N+1 需架構重構"}
     ]
   }
   ```
   `details` 每項必填 `status`（fixed/skipped/failed）和 `summary`（一行摘要）。
5. 結束（Telegram 由 scheduler.sh Phase 2 + Phase 4 發送，本 skill 不發 Telegram）

## Phase B 判斷標準

Code fix 的判斷標準、可修/不可修分類、完整修復流程詳見 `references/code-fix-rules.md`。

摘要：先 grep 定位 source → /investigate 分析根因 → 可修就開 fix branch → 走 tp-team pipeline（verify → review → cso → ship → deploy）。

## Telegram 格式與修復範圍

Telegram 報告格式（有問題/全綠）和 Phase A/B 修復範圍詳見 `references/telegram-format.md`。

## 環境需求

- report JSON 由 `daily-check-scheduler.sh` Phase 1 產出
- Telegram 需要 MCP 連線
- Code fix 需要 git、npm、claude CLI

## 排程方式

`daily-check-scheduler.sh`（cron 06:13）自動呼叫。手動觸發：直接在 Claude Code 中輸入 `/tp-daily-check`。
