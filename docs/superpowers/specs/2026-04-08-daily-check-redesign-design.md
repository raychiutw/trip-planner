# Daily Check 報告格式 + 流程重構

> 日期：2026-04-08 | 狀態：approved

## 目標

1. Telegram 報告精簡到 10-15 行，按嚴重度分組，綠燈合併一行
2. 新增全自動修復階段，能修的直接修，報告只顯示結果
3. 三個排程（tp-request、daily-check、api-server）統一 log 架構
4. error log 作為每日檢查第 9 項來源

## 架構

### 排程 pipeline（比照 tp-request-scheduler.sh）

```
daily-check-scheduler.sh (cron 06:13)
  ├── load .env.local
  ├── log rotation (7 天)
  ├── Phase 1: node scripts/daily-check.js → logs/daily-check/YYYY-MM-DD-report.json
  ├── Phase 2: claude --dangerously-skip-permissions -p "/tp-daily-check"
  │              → 讀 report JSON → 自動修復 → Telegram
  └── error handling + log
```

Shell script 結構與 `tp-request-scheduler.sh` 對齊：
- `set -eo pipefail`、`log()`、`log_error()`、`.env.local` 載入、log rotation
- 用 `claude --dangerously-skip-permissions -p` 呼叫 skill
- 錯誤寫入一般 log + error log

### Log 目錄結構

```
scripts/logs/
  ├── tp-request/
  │     ├── YYYY-MM-DD.log
  │     └── YYYY-MM-DD.error.log
  ├── daily-check/
  │     ├── YYYY-MM-DD.log
  │     ├── YYYY-MM-DD.error.log
  │     └── YYYY-MM-DD-report.json
  └── api-server/
        ├── YYYY-MM-DD.log
        ├── YYYY-MM-DD.error.log
        ├── stdout.log          ← launchd StandardOutPath
        └── stderr.log          ← launchd StandardErrorPath
```

### 統一 Log 規範

三個排程共用：

| 規則 | 格式 |
|------|------|
| 一般 | `[YYYY-MM-DD HH:mm:ss] 訊息` |
| 錯誤 | `[YYYY-MM-DD HH:mm:ss] [error] 訊息` → 同時寫入 `.log` + `.error.log` |
| rotation | 7 天，兩種檔案都清 |

Shell script log 函式：
```bash
log()      { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$ERR_LOG_FILE"
}
```

## daily-check 檢查來源

| # | 來源 | 說明 |
|---|------|------|
| 1 | Sentry | unresolved error issues（24hr） |
| 2 | API errors | D1 logs 4xx/5xx（24hr） |
| 3 | Workers analytics | requests, errors, P50/P99 latency |
| 4 | Web analytics | visits, page views |
| 5 | npm audit | production vulnerabilities |
| 6 | Request errors | 卡住的 trip-request（failed, open >1hr） |
| 7 | D1 stats | API logs, server/client errors, audit count |
| **8** | **排程 error log** | 掃描三個目錄的 `*.error.log`（近 24hr），列出錯誤筆數和摘要 |

已移除：~~Encoding warnings~~（Windows encoding 問題，macOS 不再發生）

## 自動修復

### 修復範圍

| 來源 | 可修復的錯誤 | 修復動作 |
|------|------------|---------|
| tp-request | status 卡在 received/processing | PATCH → open |
| api-server | process loop crash 後 request 卡住 | PATCH 卡住的 request → open |
| daily-check | 上次修復失敗的項目 | 重試一次 |

### 流程

1. Claude `/tp-daily-check` 讀取 report JSON
2. 判斷哪些項目可自動修復
3. 執行修復（API 呼叫）
4. 產出合併報告（檢查結果 + 修復結果）
5. 發送 Telegram

## Telegram 報告格式

### 有問題時（10-15 行）

```
📊 Tripline 每日報告 04/08
──────────────
🔴 API errors: 12 筆 4xx/5xx
⚠️ Sentry: 3 unresolved issues
⚠️ 排程錯誤: tp-request 2 筆
──────────────
🔧 自動修復:
  ├── tp-request: 2 筆 status 回滾 → open
  ├── R12: 補齊 5 筆 rating
  └── R15: 補齊 2 筆 note
──────────────
📈 Workers: 1,234 req | err 0.1% | P50 45ms P99 320ms
📈 Analytics: 89 visits, 234 views
📈 npm: 0 vulnerabilities
✅ OK: api-server, daily-check
```

### 全綠時（1 行）

```
📊 04/08 ✅ 全綠｜🔧 無需修復
```

### 格式規則

- 🔴/⚠️ 項目展開顯示
- 📈 指標型項目（Workers、Analytics、npm）固定顯示數據
- 🔧 自動修復獨立區塊，列出做了什麼
- ✅ 無數據的 OK 項目合併一行
- 全綠時極簡一行（但仍附 📈 指標）

## 需要變更的檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `scripts/daily-check-scheduler.sh` | **新建** — 比照 tp-request-scheduler.sh | 新檔 |
| `scripts/tp-request-scheduler.sh` | log 路徑 → `logs/tp-request/`，加 `log_error` | 修改 |
| `scripts/tripline-api-server.ts` | log 路徑 → `logs/api-server/`，加 error log 寫入 | 修改 |
| `scripts/com.tripline.api-server.plist` | stdout/stderr 路徑 → `logs/api-server/` | 修改 |
| `scripts/daily-check.js` | 移除 encoding warnings + 新增第 8 項檢查（掃描三個 error log） | 修改 |
| `.claude/skills/tp-daily-check/SKILL.md` | 更新流程（加自動修復階段 + 新 Telegram 格式） | 修改 |

### 遷移

- 舊 log 檔案搬移到對應子目錄
- 空檔案（`request-job-*.log`、`tp-request-launchd*.log`）刪除
