#!/bin/zsh
# poi-enrich-scheduler.sh — 每月 1 號 09:00 Asia/Taipei 排程：
# 跑 scripts/poi-enrich-batch.ts --limit=200，補新 POI 的 OSM rating + tags。
# 結果走 Telegram (admin home bot)。
#
# 觸發來源：launchd `com.tripline.poi-enrich-monthly`
# 模仿 daily-check-scheduler.sh 同 pattern（log dir + scheduler-common.sh + Telegram fail/summary）。
set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs/poi-enrich"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
ERR_LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).error.log"
RUN_DATE=$(date +%Y-%m-%d)

# Source 共用 helpers (mkdir log dir + log/log_error funcs + load .env.local)
source "$PROJECT_DIR/scripts/lib/scheduler-common.sh"

# --- Telegram 發送函式 (同 daily-check-scheduler 同 pattern) ---
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

log "==== POI enrich monthly batch 開始 (limit=200) ===="

BATCH_OUTPUT="$LOG_DIR/$(date +%Y-%m-%d)-batch-output.log"

# 跑 batch — 不 fail-fast，後面解析 stats
set +e
/opt/homebrew/bin/bun "$PROJECT_DIR/scripts/poi-enrich-batch.ts" --limit=200 > "$BATCH_OUTPUT" 2>&1
EXIT_CODE=$?
set -e

# 從 batch 輸出 grep stats（格式：「  updated:  N」「  cached:   N」 etc.）
UPDATED=$(grep -E "^\s*updated:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
CACHED=$(grep -E "^\s*cached:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
NO_DATA=$(grep -E "^\s*no_data:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
ERROR=$(grep -E "^\s*error:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
TOTAL=$(grep -E "^\s*total:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)

# 統計 error 種類
ERR_BREAKDOWN=$(grep "ERROR:" "$BATCH_OUTPUT" 2>/dev/null | awk -F'ERROR: ' '{print $2}' | sort | uniq -c | sort -rn | head -3 | awk '{printf "%s×%d ", $2$3$4, $1}' || echo "")

log "Batch 結束 (exit=$EXIT_CODE) — total=$TOTAL updated=$UPDATED cached=$CACHED no_data=$NO_DATA error=$ERROR"

# 組 Telegram 摘要
if [ "$EXIT_CODE" != "0" ] && [ "$TOTAL" = "0" ]; then
  # batch 完全 crash（沒處理任何 POI）— 緊急通知
  TG_MSG="❌ POI enrich monthly FAILED ($RUN_DATE)
Exit code: $EXIT_CODE
Log: $LOG_FILE
Output (last 10 lines):
$(tail -10 "$BATCH_OUTPUT")"
else
  # 正常結束（即使有部分 error 也是 OK，下個月會 retry）
  TG_MSG="📍 POI enrich monthly 完成 ($RUN_DATE)
✓ updated: $UPDATED
○ cached:  $CACHED
— no_data: $NO_DATA
✗ error:   $ERROR
─────────
total:     $TOTAL"
  if [ -n "$ERR_BREAKDOWN" ]; then
    TG_MSG="$TG_MSG

Errors: $ERR_BREAKDOWN"
  fi
fi

send_telegram "$TG_MSG"
log "==== POI enrich monthly batch 結束 ===="
exit "$EXIT_CODE"
