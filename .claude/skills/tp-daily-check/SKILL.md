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
   {"total": 3, "fixed": 2, "failed": 1, "pr_url": "https://github.com/.../pull/160", "details": [...]}
   ```
5. 結束（Telegram 由 scheduler.sh Phase 2 + Phase 4 發送，本 skill 不發 Telegram）

## Phase B 判斷標準

### Phase B 鐵律：先 investigate，不要猜

**不要因為 Sentry 沒給 file path 就放棄。** 你有整個 codebase — 用 error message grep 找到 source file，然後修。

```
每個 issue →
  1. 用 Grep 搜尋 error message / 關鍵字 → 定位 source file
  2. 用 /investigate 分析根因（如需要）
  3. 判定：可修 → fix  |  真的不可修 → 標記原因
```

### 可自動修（預設嘗試修復）

| 類型 | 定位方式 | 修法 |
|------|---------|------|
| React render error | grep error message → 找到 component | 修正 render 邏輯 |
| API auth error（自家 caller） | grep 401/403 的 API path → 找到 caller | 修正 auth header |
| Dynamic import failure | grep module path → 檢查 build output | 重新 build 或修 import |
| N+1 pattern | grep Sentry issue title → 找到呼叫點 | 合併 API 呼叫 |
| Infinite loop / update depth | grep setState + useEffect → 找到 component | 修正 dependency |
| 效能問題（P50/P99 偏高） | 分析 Workers analytics → 找到慢 endpoint | 優化 handler |

### 真正不可修（才標記「需人工處理」）

只有以下情況才允許標記「需人工」，且必須附上嘗試過的步驟：

| 類型 | 範例 | 為什麼不可修 |
|------|------|------------|
| 第三方 API 完全掛掉 | Cloudflare API 502 | 我方無法修對方 |
| npm critical + breaking change | major version bump 需要改 API | 影響範圍太大 |
| 需要新 migration | DB schema 不支援 | 需要 migration plan review |

**「Sentry 缺 file path」「找不到 source」不是放棄的理由。** grep 找。

### Code Fix 流程

```
所有可修 issues 共用一個 branch：
  git checkout -b fix/daily-check-autofix-YYYY-MM-DD
  → 逐一修復每個 issue（每個 issue 一個 commit）
    → /investigate（根因分析）
    → 寫 code（遵守 tp-team Build 規則）
    → commit（描述修了什麼）
  → 全部修完後一次性走 review pipeline：
    → /tp-code-verify（不可跳過）
    → /review（不可跳過）
    → /cso --diff（不可跳過）
    → /ship（建 1 個 PR，包含所有 fix commits）
    → /land-and-deploy（merge + deploy）
    → 結果寫入 Telegram 報告
```

**一天只開一個 fix branch + 一個 PR。** 若任一 commit 失敗，標記失敗原因，繼續下一個 issue。最終 PR 只包含成功的 fix。

## Telegram 格式

有問題時：
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

全綠時：
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

## 環境需求

- report JSON 由 `daily-check-scheduler.sh` Phase 1 產出
- Telegram 需要 MCP 連線
- Code fix 需要 git、npm、claude CLI

## 排程方式

`daily-check-scheduler.sh`（cron 06:13）自動呼叫。手動觸發：直接在 Claude Code 中輸入 `/tp-daily-check`。
