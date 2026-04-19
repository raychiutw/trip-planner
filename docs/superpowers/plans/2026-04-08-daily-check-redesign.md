# Daily Check Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 統一三個排程的 log 架構，精簡 Telegram 報告格式，新增全自動修復流程。

**Architecture:** 建立 `scripts/logs/{tp-request,daily-check,api-server}/` 子目錄結構，三個排程統一 `log()` + `log_error()` 雙寫規範。daily-check.js 移除 encoding warnings、新增排程 error log 掃描、改寫 Telegram 格式。daily-check-scheduler.sh 比照 tp-request-scheduler.sh 結構。tp-daily-check skill 改為全自動修復流程。

**Tech Stack:** Node.js (daily-check.js), Bun/TypeScript (tripline-api-server.ts), Shell (scheduler), launchd plist

**Spec:** `docs/superpowers/specs/2026-04-08-daily-check-redesign-design.md`

---

## File Structure

| 檔案 | 角色 | 變更 |
|------|------|------|
| `scripts/tp-request-scheduler.sh` | tp-request 排程入口 | 修改 — log 路徑 + log_error |
| `scripts/tripline-api-server.ts` | API server + tp-request job | 修改 — log 路徑 + error log |
| `scripts/com.tripline.api-server.plist` | launchd 設定 | 修改 — stdout/stderr 路徑 |
| `scripts/daily-check-scheduler.sh` | daily-check 排程入口 | **新建** |
| `scripts/daily-check.js` | 每日檢查報告產生器 | 修改 — 移除 encoding + 新增 error log 掃描 + Telegram 格式 |
| `.claude/skills/tp-daily-check/SKILL.md` | daily-check skill | 修改 — 自動修復流程 |

---

### Task 1: 建立 log 子目錄結構 + 搬移舊 log

**Files:**
- Create: `scripts/logs/tp-request/`, `scripts/logs/daily-check/`, `scripts/logs/api-server/`

- [ ] **Step 1: 建立子目錄並搬移舊檔案**

```bash
cd /Users/ray/Projects/trip-planner/scripts/logs

# 建立子目錄
mkdir -p tp-request daily-check api-server

# 搬移 tp-request 相關
mv tp-request-*.log tp-request/ 2>/dev/null || true
mv tripline-job-*.log tp-request/ 2>/dev/null || true

# 搬移 daily-check 相關
mv daily-check-*.json daily-check/ 2>/dev/null || true

# 搬移 api-server 相關
mv tripline-api-*.log api-server/ 2>/dev/null || true
mv api-server-stdout.log api-server/stdout.log 2>/dev/null || true
mv api-server-stderr.log api-server/stderr.log 2>/dev/null || true

# 刪除空檔案 / 舊版殘留
rm -f request-job-stderr.log request-job-stdout.log tp-request-launchd.log tp-request-launchd-err.log
```

- [ ] **Step 2: 確認搬移結果**

Run: `find scripts/logs -type f | sort`

Expected: 所有檔案都在子目錄內，根目錄無殘留（`.gitkeep` 除外）

- [ ] **Step 3: Commit**

```bash
git add -A scripts/logs/
git commit -m "chore: reorganize logs into tp-request/ daily-check/ api-server/ subdirs"
```

---

### Task 2: tp-request-scheduler.sh — log 路徑 + log_error

**Files:**
- Modify: `scripts/tp-request-scheduler.sh`

- [ ] **Step 1: 更新 log 路徑和 log 函式**

將 `scripts/tp-request-scheduler.sh` 的 log 區塊改為：

```bash
#!/bin/zsh
# tp-request-scheduler.sh — 每分鐘排程：查詢 open 請求並呼叫 claude /tp-request
set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs/tp-request"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
ERR_LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).error.log"

mkdir -p "$LOG_DIR"

log()      { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$ERR_LOG_FILE"
}

# Log rotation: delete files older than 7 days
find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
find "$LOG_DIR" -name "*.error.log" -mtime +7 -delete 2>/dev/null || true
```

- [ ] **Step 2: 把所有錯誤路徑的 `log` 改為 `log_error`**

在同一檔案中，將以下行的 `log` 改為 `log_error`：

```bash
# 第 31 行附近
  log_error "API 呼叫失敗: $RESPONSE"
  log_error "--- 排程結束（錯誤）---"

# 第 63 行附近
  } || log_error "  id=$rid PATCH received 失敗"

# 第 73 行附近
  log_error "Claude 執行失敗，回滾 status → open"

# 第 81 行附近
      log_error "  id=$rid 回滾失敗"

# 第 83 行附近
  log_error "--- 排程結束（錯誤）---"
```

- [ ] **Step 3: 確認語法正確**

Run: `zsh -n scripts/tp-request-scheduler.sh`
Expected: 無輸出（語法正確）

- [ ] **Step 4: Commit**

```bash
git add scripts/tp-request-scheduler.sh
git commit -m "refactor: tp-request-scheduler log → logs/tp-request/ + error log"
```

---

### Task 3: tripline-api-server.ts — log 路徑 + error log

**Files:**
- Modify: `scripts/tripline-api-server.ts:37-49`

- [ ] **Step 1: 更新 LOG_DIR 和 log 函式**

將 `scripts/tripline-api-server.ts` 第 37-49 行改為：

```typescript
const LOG_DIR = join(PROJECT_DIR, 'scripts', 'logs', 'api-server');
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// --- Logging ---
mkdirSync(LOG_DIR, { recursive: true });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.log`), line); } catch {}
}

function logError(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [error] ${msg}\n`;
  process.stderr.write(line);
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.log`), line); } catch {}
  try { appendFileSync(join(LOG_DIR, `${todayStr()}.error.log`), line); } catch {}
}
```

- [ ] **Step 2: 把錯誤場景的 `log()` 改為 `logError()`**

在同一檔案中替換以下呼叫：

```typescript
// fetchOldestOpen 失敗（第 76 行附近）
logError(`fetchOldestOpen failed: ${res.status}`);

// patchStatus 失敗（第 96 行附近）
logError(`patchStatus(${id}, ${status}) failed: ${res.status}`);

// Claude 失敗（第 129 行附近）
logError(`Claude failed (exit ${code}): ${stderr.slice(0, 200)}`);

// Claude spawn error（第 136 行附近）
logError(`Claude spawn error: ${err.message}`);

// Claude timeout（第 119 行附近）
logError('Claude timeout — killing process');

// patchStatus final 失敗（第 180 行附近）
logError(`Request ${req.id}: failed to patch final status '${finalStatus}'`);

// claim 失敗（第 167 行附近）
logError(`Request ${req.id}: failed to claim (patchStatus → false), skipping`);

// consecutive failures（第 170 行附近）
logError(`${MAX_CONSECUTIVE_FAILURES} consecutive failures, stopping loop`);

// processLoop error（第 188 行附近）
logError(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);

// processLoop unhandled（第 238 行附近）
logError(`processLoop unhandled: ${err}`);

// verifyAuth warning（第 199 行附近）
logError('WARNING: TRIPLINE_API_SECRET not set — rejecting all requests');
```

- [ ] **Step 3: 確認 TypeScript 編譯**

Run: `cd /Users/ray/Projects/trip-planner && bun build scripts/tripline-api-server.ts --no-bundle 2>&1 | head -5`
Expected: 無 error

- [ ] **Step 4: Commit**

```bash
git add scripts/tripline-api-server.ts
git commit -m "refactor: api-server log → logs/api-server/ + error log"
```

---

### Task 4: com.tripline.api-server.plist — 更新路徑

**Files:**
- Modify: `scripts/com.tripline.api-server.plist:24-27`

- [ ] **Step 1: 更新 StandardOutPath / StandardErrorPath**

```xml
    <key>StandardOutPath</key>
    <string>/Users/ray/Projects/trip-planner/scripts/logs/api-server/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ray/Projects/trip-planner/scripts/logs/api-server/stderr.log</string>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/com.tripline.api-server.plist
git commit -m "chore: update plist log paths to logs/api-server/"
```

- [ ] **Step 3: 重新載入 launchd（需手動確認）**

```bash
launchctl unload ~/Library/LaunchAgents/com.tripline.api-server.plist 2>/dev/null || true
cp scripts/com.tripline.api-server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.tripline.api-server.plist
```

> ⚠️ 這會重啟 API server，確認 Key User 同意再執行。

---

### Task 5: daily-check.js — 移除 encoding + 新增 error log 掃描 + Telegram 格式

**Files:**
- Modify: `scripts/daily-check.js`

- [ ] **Step 1: 更新 report JSON 輸出路徑**

將第 792-799 行改為：

```javascript
  // 確保 logs 目錄存在
  var logsDir = path.join(__dirname, 'logs', 'daily-check');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 寫出 JSON
  var outPath = path.join(logsDir, today + '-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Report written to: ' + outPath);
```

- [ ] **Step 2: 移除 encoding warnings**

刪除 `queryEncodingWarnings` 函式（第 179-205 行）。

從 `main()` 的 `Promise.allSettled` 陣列中移除 `queryEncodingWarnings()` （第 747 行），並移除對應的 `var encodingWarnings = val(2, ...)` 和 report 物件中的 `encodingWarnings` 欄位。更新 `calcSummary` 呼叫移除 `encodingWarnings` 參數。

從 `buildTelegramText` 中移除 encoding warnings 區塊（第 518-526 行）。

從 `calcSummary` 函式簽名和 `sections` 陣列中移除 `encodingWarnings`。

- [ ] **Step 3: 新增 error log 掃描函式**

在 `queryD1Stats` 後面新增：

```javascript
// ── 數據來源 8: 排程 error log ────────────────────────────────

function querySchedulerErrors() {
  var baseDir = path.join(__dirname, 'logs');
  var dirs = ['tp-request', 'daily-check', 'api-server'];
  var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var results = {};
  var totalErrors = 0;

  dirs.forEach(function(dir) {
    var dirPath = path.join(baseDir, dir);
    var errors = [];
    try {
      var files = fs.readdirSync(dirPath).filter(function(f) {
        return f.endsWith('.error.log');
      });
      files.forEach(function(f) {
        var filePath = path.join(dirPath, f);
        var stat = fs.statSync(filePath);
        if (stat.mtime < cutoff) return;
        var content = fs.readFileSync(filePath, 'utf8').trim();
        if (!content) return;
        var lines = content.split('\n');
        lines.forEach(function(line) {
          var match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[error\] (.+)/);
          if (match) {
            var ts = new Date(match[1].replace(' ', 'T'));
            if (ts >= cutoff) {
              errors.push({ time: match[1], message: match[2].substring(0, 100) });
            }
          }
        });
      });
    } catch (e) {}
    results[dir] = { count: errors.length, errors: errors.slice(0, 5) };
    totalErrors += errors.length;
  });

  return {
    status: totalErrors > 0 ? 'warning' : 'ok',
    total: totalErrors,
    details: results
  };
}
```

- [ ] **Step 4: 在 main() 中加入 error log 掃描**

在 `var npmAuditResult = queryNpmAudit();` 後面加入：

```javascript
  var schedulerErrors = querySchedulerErrors();
```

在 report 物件中加入：

```javascript
    schedulerErrors: schedulerErrors,
```

更新 `calcSummary` 加入 `schedulerErrors`。

- [ ] **Step 5: 改寫 buildTelegramText 為新格式**

替換整個 `buildTelegramText` 函式為：

```javascript
function buildTelegramText(report) {
  var today = report.date.slice(5).replace('-', '/');
  var lines = [];

  // 收集問題項目
  var issues = [];
  if (report.apiErrors && report.apiErrors.total > 0) {
    var icon = report.apiErrors.status === 'critical' ? '🔴' : '⚠️';
    issues.push(icon + ' API errors: ' + report.apiErrors.total + ' 筆');
  }
  if (report.sentry && report.sentry.total > 0) {
    issues.push('⚠️ Sentry: ' + report.sentry.total + ' 筆');
  }
  if (report.requestErrors && report.requestErrors.total > 0) {
    issues.push('⚠️ 未完成請求: ' + report.requestErrors.total + ' 筆');
  }
  if (report.d1Stats && report.d1Stats.serverErrors > 0) {
    issues.push('⚠️ D1 server errors: ' + report.d1Stats.serverErrors + ' 筆');
  }
  if (report.schedulerErrors && report.schedulerErrors.total > 0) {
    var se = report.schedulerErrors.details;
    var parts = [];
    ['tp-request', 'daily-check', 'api-server'].forEach(function(k) {
      if (se[k] && se[k].count > 0) parts.push(k + ' ' + se[k].count + ' 筆');
    });
    issues.push('⚠️ 排程錯誤: ' + parts.join(', '));
  }
  if (report.npmAudit && report.npmAudit.total > 0) {
    issues.push('⚠️ npm vulnerabilities: ' + report.npmAudit.total + ' 個');
  }

  // 指標數據
  var metrics = [];
  if (report.workers) {
    var p50 = report.workers.p50 || 0;
    var p99 = report.workers.p99 || 0;
    // Workers API 回傳 μs，轉換為 ms 顯示
    metrics.push('📈 Workers: ' + (report.workers.requests || 0).toLocaleString() + ' req | err ' +
      (report.workers.errorRate || '0%') + ' | P50 ' + Math.round(p50 / 1000) + 'ms P99 ' + Math.round(p99 / 1000) + 'ms');
  }
  if (report.web) {
    metrics.push('📈 Analytics: ' + (report.web.visits || 0) + ' visits, ' + (report.web.pageViews || 0) + ' views');
  }
  if (report.npmAudit && report.npmAudit.total === 0) {
    metrics.push('📈 npm: 0 vulnerabilities');
  }

  // OK 項目
  var okItems = [];
  if (!report.schedulerErrors || report.schedulerErrors.details['api-server'].count === 0) okItems.push('api-server');
  if (!report.schedulerErrors || report.schedulerErrors.details['daily-check'].count === 0) okItems.push('daily-check');
  if (!report.schedulerErrors || report.schedulerErrors.details['tp-request'].count === 0) okItems.push('tp-request');

  // 全綠判定
  if (issues.length === 0) {
    lines.push('📊 ' + today + ' ✅ 全綠');
  } else {
    lines.push('📊 Tripline 每日報告 ' + today);
    lines.push('──────────────');
    issues.forEach(function(i) { lines.push(i); });
  }

  // 指標固定顯示
  if (metrics.length > 0) {
    lines.push('──────────────');
    metrics.forEach(function(m) { lines.push(m); });
  }

  // OK 合併
  if (okItems.length > 0) {
    lines.push('✅ OK: ' + okItems.join(', '));
  }

  return lines.join('\n');
}
```

- [ ] **Step 6: 移除 autofix 階段（改由 tp-daily-check skill 處理）**

刪除 `main()` 中第 816-833 行的 autofix 區塊（`analyzeForAutofix` + `runAutofix` + `buildAutofixTelegramText` 呼叫）。

同時刪除 `analyzeForAutofix`、`runAutofix`、`buildAutofixTelegramText` 函式定義。

daily-check.js 只負責產出 report JSON，自動修復由 Claude `/tp-daily-check` skill 負責。

- [ ] **Step 7: 移除舊 Telegram 發送（改由 skill 處理）**

刪除 `main()` 中第 805-814 行的 Telegram 發送區塊。daily-check.js 只產 JSON，Telegram 由 scheduler → Claude skill 發送。

- [ ] **Step 8: 確認腳本可執行**

Run: `node scripts/daily-check.js --dry-run 2>&1 | tail -5`

Expected: `Report written to: scripts/logs/daily-check/YYYY-MM-DD-report.json`

- [ ] **Step 9: Commit**

```bash
git add scripts/daily-check.js
git commit -m "refactor: daily-check.js 移除 encoding/autofix/telegram + 新增 error log 掃描 + 精簡格式"
```

---

### Task 6: daily-check-scheduler.sh — 新建

**Files:**
- Create: `scripts/daily-check-scheduler.sh`

- [ ] **Step 1: 建立 scheduler shell script**

```bash
#!/bin/zsh
# daily-check-scheduler.sh — 每日 06:13 排程：執行 daily-check.js + claude /tp-daily-check
set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs/daily-check"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
ERR_LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).error.log"

mkdir -p "$LOG_DIR"

log()      { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$ERR_LOG_FILE"
}

# Log rotation: delete files older than 7 days
find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
find "$LOG_DIR" -name "*.error.log" -mtime +7 -delete 2>/dev/null || true
find "$LOG_DIR" -name "*-report.json" -mtime +7 -delete 2>/dev/null || true

# Load .env.local
if [ -f "$PROJECT_DIR/.env.local" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$value"
  done < "$PROJECT_DIR/.env.local"
fi

log "--- 排程啟動 ---"

# Phase 1: 執行 daily-check.js 產出報告 JSON
log "Phase 1: 執行 daily-check.js"
cd "$PROJECT_DIR"

if node scripts/daily-check.js >> "$LOG_FILE" 2>&1; then
  log "Phase 1 完成"
else
  log_error "daily-check.js 執行失敗"
  log_error "--- 排程結束（錯誤）---"
  exit 1
fi

# Phase 2: 呼叫 Claude tp-daily-check（自動修復 + Telegram）
log "Phase 2: claude /tp-daily-check"

if claude --dangerously-skip-permissions -p "/tp-daily-check" >> "$LOG_FILE" 2>&1; then
  log "Phase 2 完成"
else
  log_error "Claude /tp-daily-check 執行失敗"
  log_error "--- 排程結束（錯誤）---"
  exit 1
fi

log "--- 排程結束 ---"
```

- [ ] **Step 2: 設定執行權限**

Run: `chmod +x scripts/daily-check-scheduler.sh`

- [ ] **Step 3: 語法檢查**

Run: `zsh -n scripts/daily-check-scheduler.sh`
Expected: 無輸出

- [ ] **Step 4: Commit**

```bash
git add scripts/daily-check-scheduler.sh
git commit -m "feat: add daily-check-scheduler.sh (比照 tp-request-scheduler.sh)"
```

---

### Task 7: tp-daily-check SKILL.md — 自動修復流程

**Files:**
- Modify: `.claude/skills/tp-daily-check/SKILL.md`

- [ ] **Step 1: 更新 SKILL.md**

替換整個檔案內容為：

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/tp-daily-check/SKILL.md
git commit -m "refactor: tp-daily-check skill — 全自動修復 + 精簡 Telegram 格式"
```

---

## Self-Review

**Spec coverage:**
- ✅ Log 目錄結構（Task 1）
- ✅ 統一 log 規範 + log_error（Task 2, 3, 6）
- ✅ tp-request-scheduler.sh 更新（Task 2）
- ✅ tripline-api-server.ts 更新（Task 3）
- ✅ launchd plist 更新（Task 4）
- ✅ daily-check.js 移除 encoding + 新增 error log + Telegram 格式（Task 5）
- ✅ daily-check-scheduler.sh 新建（Task 6）
- ✅ tp-daily-check SKILL.md 更新（Task 7）
- ✅ 舊 log 搬移 + 清理（Task 1）

**Placeholder scan:** 無 TBD/TODO

**Type consistency:** `log()` / `log_error()` (shell) 和 `log()` / `logError()` (TypeScript) 命名一致（各自語言慣例）
