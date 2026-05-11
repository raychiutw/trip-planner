# scheduler-common.sh — 排程共用函式（由各 scheduler source）
# 使用前必須設定: LOG_DIR, LOG_FILE, ERR_LOG_FILE

# Claude CLI 絕對路徑（launchd PATH 不含 ~/.local/bin，必須寫絕對路徑）
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"

mkdir -p "$LOG_DIR"

log()      { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [error] $1" >> "$ERR_LOG_FILE"
}

# Log rotation: delete files older than 7 days
find "$LOG_DIR" \( -name "*.log" -o -name "*-report.json" \) -mtime +7 -delete 2>/dev/null || true

# Load .env.local — 透過 Node dotenv parser
# 舊版用 `while IFS= read -r line` 土法 parse，遇 multi-line single-quoted JSON
# （例：GOOGLE_CLOUD_SA_KEY 的 private_key）會把每行 base64 切片當獨立 KEY=VALUE
# export → zsh 丟「not an identifier」+ `set -eo pipefail` 中止 source → 整支
# scheduler 沒建 LOG_FILE 就死（觀察到 2026-05-11 06:13 .context stderr.log 即此）。
# load-env.mjs 用 dotenv 正確 parse 後輸出 ANSI-C quoted `export` 指令。
#
# NOTE：絕對不要用 `2>&1` 合併 stderr 進來 eval。load-env.mjs 對非法 key 寫 warning
# 到 stderr；合併後 eval 該文字 → zsh `command not found` → `set -eo pipefail` 中止
# → 重現原本要修的同類沉默死亡。讓 stderr 流到 launchd StandardErrorPath。
if [ -f "$PROJECT_DIR/.env.local" ]; then
  _env_exports=$(node "$PROJECT_DIR/scripts/lib/load-env.mjs" "$PROJECT_DIR/.env.local") || {
    echo "[scheduler-common] load-env.mjs 失敗（exit non-zero）— 詳見 stderr log" >&2
    exit 1
  }
  eval "$_env_exports"
  unset _env_exports
fi
