#!/bin/zsh
# tp-request-scheduler.sh — 每分鐘排程：查詢 open 請求並呼叫 claude /tp-request
set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs/tp-request"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
ERR_LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).error.log"

source "$PROJECT_DIR/scripts/lib/scheduler-common.sh"

log "--- 排程啟動 ---"

# Query open requests
RESPONSE=$(curl -sf \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  "https://trip-planner-dby.pages.dev/api/requests?status=open" 2>&1) || {
  log_error "API 呼叫失敗: $RESPONSE"
  log_error "--- 排程結束（錯誤）---"
  exit 1
}

COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo "0")

log "查詢結果: $COUNT 筆 open 請求"

if [ "$COUNT" -eq 0 ]; then
  log "--- 排程結束（無待處理）---"
  exit 0
fi

# Extract request IDs and PATCH status → received
IDS=$(echo "$RESPONSE" | python3 -c "
import sys, json
for r in json.load(sys.stdin):
    print(f\"{r['id']}|{r.get('trip_id','')}|{r.get('mode','')}|{str(r.get('message',''))[:50]}\")
" 2>/dev/null)

PATCHED_IDS=()
while IFS='|' read -r rid trip_id mode msg; do
  log "  id=$rid trip=$trip_id mode=$mode msg=$msg"
  curl -sf -X PATCH \
    -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"status":"received"}' \
    "https://trip-planner-dby.pages.dev/api/requests/$rid" > /dev/null 2>&1 && {
    log "  id=$rid status → received"
    PATCHED_IDS+=("$rid")
  } || log_error "  id=$rid PATCH received 失敗"
done <<< "$IDS"

# Invoke Claude tp-request
log "開始處理: claude /tp-request"
cd "$PROJECT_DIR"

if "$CLAUDE_BIN" --dangerously-skip-permissions -p "/tp-request" >> "$LOG_FILE" 2>&1; then
  log "處理完成"
else
  log_error "Claude 執行失敗，回滾 status → open"
  for rid in "${PATCHED_IDS[@]}"; do
    curl -sf -X PATCH \
      -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
      -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
      -H "Content-Type: application/json" \
      -d '{"status":"open"}' \
      "https://trip-planner-dby.pages.dev/api/requests/$rid" > /dev/null 2>&1 && \
      log "  id=$rid 回滾 → open" || log_error "  id=$rid 回滾失敗"
  done
  log_error "--- 排程結束（錯誤）---"
  exit 1
fi

log "--- 排程結束 ---"
