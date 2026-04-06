#!/bin/zsh
# tripline-job.sh — 15 分鐘排程：卡住偵測 + 遺漏處理
set -eo pipefail

PROJECT_DIR="/Users/ray/Desktop/Source/trip-planner"
LOG_DIR="$PROJECT_DIR/scripts/logs"
LOG_FILE="$LOG_DIR/tripline-job-$(date +%Y-%m-%d).log"
STALE_THRESHOLD_MIN=20  # > Claude 15 min timeout，避免 race

mkdir -p "$LOG_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Log rotation: 7 天
find "$LOG_DIR" -name "tripline-job-*.log" -mtime +7 -delete 2>/dev/null || true

# Load env
if [ -f "$PROJECT_DIR/.env.local" ]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -z "$key" ]] && continue
    export "$key=$value"
  done < "$PROJECT_DIR/.env.local"
fi

log "--- Job 啟動 ---"

# 1. 卡住偵測：processing 超過 STALE_THRESHOLD_MIN 分鐘 → 標記 failed
PROCESSING=$(curl -sf \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  "https://trip-planner-dby.pages.dev/api/requests?status=processing" 2>&1) || {
  log "查詢 processing 失敗"
  PROCESSING="[]"
}

STALE_IDS=$(echo "$PROCESSING" | python3 -c "
import sys, json
from datetime import datetime, timedelta, timezone
threshold = timedelta(minutes=${STALE_THRESHOLD_MIN})
now = datetime.now(timezone.utc)
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('items', [])
for r in items:
    updated = r.get('updated_at') or r.get('created_at', '')
    if updated:
        try:
            t = datetime.fromisoformat(updated.replace('Z', '+00:00'))
            if now - t > threshold:
                print(r['id'])
        except: pass
" 2>/dev/null)

if [ -n "$STALE_IDS" ]; then
  while read -r rid; do
    log "  卡住偵測: id=$rid → failed"
    curl -sf -X PATCH \
      -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
      -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
      -H "Content-Type: application/json" \
      -d '{"status":"failed","processed_by":"job"}' \
      "https://trip-planner-dby.pages.dev/api/requests/$rid" > /dev/null 2>&1 && \
      log "  id=$rid → failed 成功" || log "  id=$rid → failed 失敗"
  done <<< "$STALE_IDS"
else
  log "  無卡住的 processing 請求"
fi

# 2. 觸發 API server 處理遺漏的 open 請求
log "觸發 API server (source=job)"
TRIGGER_RESULT=$(curl -sf -X POST \
  -H "Authorization: Bearer $TRIPLINE_API_SECRET" \
  -H "Content-Type: application/json" \
  "http://127.0.0.1:6688/trigger?source=job" 2>&1) || {
  log "API server 觸發失敗（可能離線）: $TRIGGER_RESULT"
  log "--- Job 結束（API server 不可用）---"
  exit 0
}

log "API server 回應: $TRIGGER_RESULT"
log "--- Job 結束 ---"
