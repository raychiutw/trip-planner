#!/bin/zsh
# daily-check-scheduler.sh — 每日 06:13 排程：檢查 → 發通知 → 自動修復 → 發修復結果
set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs/daily-check"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
ERR_LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).error.log"
TODAY=$(date +%Y-%m-%d)

source "$PROJECT_DIR/scripts/lib/scheduler-common.sh"

# --- Telegram 發送函式 ---
send_telegram() {
  local msg="$1"
  local token="${TELEGRAM_BOT_HOME_TOKEN:-$TELEGRAM_BOT_TOKEN}"
  local chat_id="${TELEGRAM_CHAT_ID:-6527604594}"
  if [ -z "$token" ]; then
    log_error "TELEGRAM_BOT_TOKEN 未設定，跳過發送"
    return 1
  fi
  local body
  body=$(node -e "console.log(JSON.stringify({chat_id:'${chat_id}',text:process.argv[1]}))" "$msg")
  curl -sf -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null 2>&1 && log "Telegram 已發送" || log_error "Telegram 發送失敗"
}

# --- 從 report JSON 組裝 Telegram 訊息 ---
build_telegram_msg() {
  local report_path="$1"
  node -e "
    var fs = require('fs');
    var r = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    var today = r.date.slice(5).replace('-', '/');
    var lines = [];
    var issues = [];
    if (r.apiErrors && r.apiErrors.total > 0) {
      var icon = r.apiErrors.status === 'critical' ? '🔴' : '⚠️';
      issues.push(icon + ' API errors: ' + r.apiErrors.total + ' 筆');
    }
    if (r.sentry && r.sentry.total > 0) issues.push('⚠️ Sentry: ' + r.sentry.total + ' 筆');
    if (r.requestErrors && r.requestErrors.total > 0) issues.push('⚠️ 未完成請求: ' + r.requestErrors.total + ' 筆');
    if (r.d1Stats && r.d1Stats.serverErrors > 0) issues.push('⚠️ D1 server errors: ' + r.d1Stats.serverErrors + ' 筆');
    if (r.schedulerErrors && r.schedulerErrors.total > 0) {
      var se = r.schedulerErrors.details, parts = [];
      ['tp-request','daily-check','api-server'].forEach(function(k) { if (se[k] && se[k].count > 0) parts.push(k + ' ' + se[k].count + ' 筆'); });
      issues.push('⚠️ 排程錯誤: ' + parts.join(', '));
    }
    if (r.npmAudit && r.npmAudit.total > 0) issues.push('⚠️ npm: ' + r.npmAudit.total + ' 個漏洞');
    if (issues.length === 0) { lines.push('📊 ' + today + ' ✅ 全綠'); }
    else { lines.push('📊 Tripline 每日報告 ' + today); lines.push('──────────────'); issues.forEach(function(i) { lines.push(i); }); }
    lines.push(r.autofix ? '🔧 自動修復: ' + r.autofix.completed + ' 項完成' : '🔧 無需修復');
    lines.push('──────────────');
    if (r.workers) { var p50 = Math.round((r.workers.p50||0)/1000), p99 = Math.round((r.workers.p99||0)/1000); lines.push('📈 Workers: ' + (r.workers.requests||0).toLocaleString() + ' req | err ' + (r.workers.errorRate||'0%') + ' | P50 ' + p50 + 'ms P99 ' + p99 + 'ms'); }
    if (r.web) lines.push('📈 Analytics: ' + (r.web.visits||0) + ' visits, ' + (r.web.pageViews||0) + ' views');
    if (r.npmAudit && r.npmAudit.total === 0) lines.push('📈 npm: 0 vulnerabilities');
    var okItems = [];
    ['api-server','daily-check','tp-request'].forEach(function(k) { if (!r.schedulerErrors || !r.schedulerErrors.details[k] || r.schedulerErrors.details[k].count === 0) okItems.push(k); });
    if (okItems.length > 0) lines.push('✅ OK: ' + okItems.join(', '));
    console.log(lines.join('\n'));
  " "$report_path"
}

log "--- 排程啟動 ---"
cd "$PROJECT_DIR"

# Phase 1: 執行 daily-check.js 產出報告 JSON
log "Phase 1: 執行 daily-check.js"
if node scripts/daily-check.js >> "$LOG_FILE" 2>&1; then
  log "Phase 1 完成"
  REPORT_JSON=$(ls -t "$LOG_DIR"/*-report.json 2>/dev/null | head -1)
  FIX_RESULT="${REPORT_JSON%-report.json}-fix-result.json"
  if [ -z "$REPORT_JSON" ]; then
    log_error "找不到 report JSON"
    send_telegram "📊 Tripline 每日報告 ❌ report JSON 不存在"
    log_error "--- 排程結束（錯誤）---"
    exit 1
  fi
else
  log_error "daily-check.js 執行失敗"
  send_telegram "📊 Tripline 每日報告 ❌ daily-check.js 執行失敗"
  log_error "--- 排程結束（錯誤）---"
  exit 1
fi

# Phase 2: 發 Telegram 報告摘要
log "Phase 2: 發送 Telegram 報告"
TELEGRAM_MSG=$(build_telegram_msg "$REPORT_JSON")
send_telegram "$TELEGRAM_MSG"

# Phase 3: 呼叫 Claude tp-daily-check（自動修復）
log "Phase 3: claude /tp-daily-check（自動修復）"
if claude --dangerously-skip-permissions -p "/tp-daily-check" >> "$LOG_FILE" 2>&1; then
  log "Phase 3 完成"
else
  log_error "Claude /tp-daily-check 執行失敗"
  send_telegram "🔧 自動修復 ❌ 執行失敗，請查看 log"
  log_error "--- 排程結束（錯誤）---"
  exit 1
fi

# Phase 4: 發 Telegram 修復結果
if [ -f "$FIX_RESULT" ]; then
  FIX_MSG=$(node -e "
    var r = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
    if (r.total === 0) { console.log('🔧 無需修復'); }
    else { console.log('🔨 Code fix: ' + r.fixed + '/' + r.total + ' 項完成' + (r.pr_url ? ' ' + r.pr_url : '')); }
  " "$FIX_RESULT" 2>/dev/null)
  send_telegram "${FIX_MSG:-🔧 無需修復}"
else
  send_telegram "🔧 無需修復"
fi

log "--- 排程結束 ---"
