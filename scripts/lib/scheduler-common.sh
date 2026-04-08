# scheduler-common.sh — 排程共用函式（由各 scheduler source）
# 使用前必須設定: LOG_DIR, LOG_FILE, ERR_LOG_FILE

mkdir -p "$LOG_DIR"

log()      { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$ERR_LOG_FILE"
}

# Log rotation: delete files older than 7 days
find "$LOG_DIR" \( -name "*.log" -o -name "*-report.json" \) -mtime +7 -delete 2>/dev/null || true

# Load .env.local
if [ -f "$PROJECT_DIR/.env.local" ]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [ -n "$key" ] && export "$key=$value"
  done < "$PROJECT_DIR/.env.local"
fi
