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

# Load .env.local
#
# Parser supports：
#   KEY=value
#   KEY="quoted with spaces"
#   KEY='quoted'
#   KEY='multi
#   line
#   value'   ← v2.23.0 GOOGLE_CLOUD_SA_KEY PEM 內含 \n 跨行
#
# 之前 line-by-line export 在跨行 single-quoted value 第 2 行起 export
# 把 base64 字串當 identifier，set -eo pipefail 直接 abort 整個 scheduler。
# 結果：v2.23.0 起 daily-check cron 天天 06:13 silently fail，Telegram 從沒發送。
# 改用 state machine：偵測未閉合 single-quote，buffer 跨行內容直到收尾。
if [ -f "$PROJECT_DIR/.env.local" ]; then
  _env_in_quote=0
  _env_key=""
  _env_buffer=""
  _env_nl=$'\n'
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$_env_in_quote" -eq 0 ]; then
      # Skip comments / blank（POSIX case，不用 bashism [[ =~ ]]，
      # 因為 launchd 用 /bin/zsh 跑，zsh 不 populate $BASH_REMATCH）
      case "$line" in
        \#*|"") continue ;;
      esac
      # Find KEY=value（必須 first char 是 letter/underscore，且含 =）
      case "$line" in
        [A-Za-z_]*=*)
          _env_key="${line%%=*}"
          _env_value="${line#*=}"
          # 額外驗證 key 只含 [A-Za-z0-9_]（防破折號等異常字元）
          case "$_env_key" in
            *[!A-Za-z0-9_]*) continue ;;
          esac
          case "$_env_value" in
            "'"*"'")
              # 單行 single-quote
              _env_value="${_env_value#\'}"
              _env_value="${_env_value%\'}"
              export "$_env_key=$_env_value"
              ;;
            "'"*)
              # 開頭 single-quote 沒收尾 → 進 multiline 模式（v2.23.0 PEM key）
              _env_in_quote=1
              _env_buffer="${_env_value#\'}"
              ;;
            '"'*'"')
              # 雙引號包圍
              _env_value="${_env_value#\"}"
              _env_value="${_env_value%\"}"
              export "$_env_key=$_env_value"
              ;;
            *)
              export "$_env_key=$_env_value"
              ;;
          esac
          ;;
      esac
    else
      case "$line" in
        *"'")
          _env_buffer="${_env_buffer}${_env_nl}${line%\'}"
          export "$_env_key=$_env_buffer"
          _env_in_quote=0
          _env_key=""
          _env_buffer=""
          ;;
        *)
          _env_buffer="${_env_buffer}${_env_nl}${line}"
          ;;
      esac
    fi
  done < "$PROJECT_DIR/.env.local"
  if [ "$_env_in_quote" -eq 1 ] && [ -n "$_env_key" ]; then
    log_error "[.env.local] unclosed single-quote for $_env_key — partial value exported"
    export "$_env_key=$_env_buffer"
  fi
  unset _env_in_quote _env_key _env_buffer _env_value _env_nl
fi
