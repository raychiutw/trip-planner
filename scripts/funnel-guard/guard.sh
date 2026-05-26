#!/bin/zsh
# funnel-guard — Tailscale funnel drift detect + auto-heal + Telegram alert
#
# Why: macOS update / GUI app / 第三方 brew 反覆把 funnel :443 改成 serve
# (tailnet only) → CF Worker public /trigger 全 530。Memory
# project_tailscale_funnel_caddy_architecture.md 紀錄 v2.33.111 已第 3 次。
#
# Auto-heal pattern：launchd 每 120s 跑本 script，drift 就 reset + 重設 funnel
# + Telegram 通知。
#
# Telegram env：由 trip-planner/.env.local 載入（gitignored）。對齊
# scripts/lib/send-telegram.sh 既有模式。launchd 完全 isolated env →
# 必須 source 自己的環境變數。
set -eo pipefail

REPO_ROOT="/Users/ray/Projects/trip-planner"
TAILSCALE="/opt/homebrew/bin/tailscale"
EXPECTED_PROXY="http://127.0.0.1:8080"
LOG_PREFIX="[funnel-guard]"
KILL_SWITCH="$REPO_ROOT/scripts/funnel-guard/.disabled"
STATE_FILE="/tmp/funnel-guard.state"
ALERT_THROTTLE_SEC=3600

cd "$REPO_ROOT"

# Load Telegram credentials from .env.local — line-by-line scan only TELEGRAM_*
# 全檔 source 不可行：.env.local 含 multi-line JSON (GOOGLE_CLOUD_SA_KEY) 與
# 未 quote 的 < 字元 (EMAIL_FROM=Tripline <...>) → bash syntax error。
load_telegram_env() {
  local env_file="$1"
  [ -f "$env_file" ] || return 0
  local line key value
  while IFS= read -r line; do
    case "$line" in
      TELEGRAM_BOT_TOKEN=*|TELEGRAM_BOT_HOME_TOKEN=*|TELEGRAM_BOT_FETCI_TOKEN=*|TELEGRAM_CHAT_ID=*)
        key="${line%%=*}"
        value="${line#*=}"
        # Strip optional surrounding quotes
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        export "$key=$value"
        ;;
    esac
  done < "$env_file"
}
load_telegram_env "$REPO_ROOT/.env.local"

log() {
  echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') $*"
}

# 偵測 funnel :443 是否正確路由到 Caddy :8080
# 必須同時滿足：
#   1. AllowFunnel 含 *:443 → true（區別 funnel vs serve）
#   2. Web *:443 Handlers./.Proxy = http://127.0.0.1:8080
is_funnel_healthy() {
  local status_json
  status_json=$("$TAILSCALE" serve status --json 2>/dev/null) || return 1
  [ -z "$status_json" ] && return 1

  echo "$status_json" | jq -e --arg proxy "$EXPECTED_PROXY" '
    (.AllowFunnel // {} | to_entries
      | map(select((.key | endswith(":443")) and .value == true))
      | length > 0)
    and
    ([.Web // {} | to_entries[]
      | select(.key | endswith(":443"))
      | .value.Handlers."/".Proxy] | any(. == $proxy))
  ' >/dev/null 2>&1
}

# 重設 funnel：先 reset 既有 serve/funnel state（避免殘留 conflict）→ 重新註冊
heal_funnel() {
  log "drift 偵測：執行 reset + funnel 重設"
  "$TAILSCALE" serve reset 2>&1 | sed "s/^/$LOG_PREFIX  /" || true
  "$TAILSCALE" funnel --bg --https=443 "$EXPECTED_PROXY" 2>&1 | sed "s/^/$LOG_PREFIX  /"
}

# Telegram alert via 既有 helper（validates token format + chat_id）
send_alert() {
  local msg="$1"
  if [ -x "$REPO_ROOT/scripts/lib/send-telegram.sh" ]; then
    bash "$REPO_ROOT/scripts/lib/send-telegram.sh" "$msg" 2>&1 | sed "s/^/$LOG_PREFIX  /" || true
  else
    log "send-telegram.sh 不存在 — 跳過 alert"
  fi
}

# State-transition alerting：避免持續 drift 時 Telegram flood（every 120s ping）。
# 規則：
#   - healthy steady-state：silent
#   - unhealthy → healthy（recovery）：always alert
#   - 任何 state change：alert
#   - 同 state 連續：每 ALERT_THROTTLE_SEC (1hr) 最多 1 個
read_state() {
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    echo "unknown|0"
  fi
}

write_state() {
  printf '%s|%s\n' "$1" "$2" > "$STATE_FILE"
}

should_alert() {
  local prev_state="$1" new_state="$2" prev_ts="$3" now="$4"
  # Recovery transition：unhealthy* → healthy always
  if [ "$new_state" = "healthy" ] && [ "$prev_state" != "healthy" ] && [ "$prev_state" != "unknown" ]; then
    return 0
  fi
  # Healthy steady-state never
  if [ "$new_state" = "healthy" ]; then
    return 1
  fi
  # State change always
  if [ "$prev_state" != "$new_state" ]; then
    return 0
  fi
  # Same state — throttle
  if [ $(( now - prev_ts )) -ge $ALERT_THROTTLE_SEC ]; then
    return 0
  fi
  return 1
}

# 包 send_alert + state file update。only_on_change=true 時不重置 throttle 計時。
maybe_alert() {
  local prev_state="$1" prev_ts="$2" new_state="$3" msg="$4"
  local now
  now=$(date +%s)
  if should_alert "$prev_state" "$new_state" "$prev_ts" "$now"; then
    send_alert "$msg"
    write_state "$new_state" "$now"
  else
    # 保留舊 ts 維持 throttle window
    write_state "$new_state" "$prev_ts"
  fi
}

main() {
  # M1 kill-switch：incident response 時 `touch .disabled` 暫停 auto-heal
  if [ -f "$KILL_SWITCH" ]; then
    log "kill-switch (.disabled) present — 跳過 heal"
    exit 0
  fi

  local state_line prev_state prev_ts
  state_line=$(read_state)
  prev_state="${state_line%%|*}"
  prev_ts="${state_line##*|}"

  if is_funnel_healthy; then
    log "healthy"
    maybe_alert "$prev_state" "$prev_ts" "healthy" \
      "🛡️ Tripline funnel-guard：funnel 已恢復 healthy（之前狀態 $prev_state）"
    exit 0
  fi

  log "drift 偵測 — 開始 heal"
  if heal_funnel; then
    # 5s 等 tailscaled converge + DERP relay reconnect
    sleep 5
    if is_funnel_healthy; then
      log "heal 成功"
      maybe_alert "$prev_state" "$prev_ts" "healed" \
        "🛡️ Tripline funnel-guard：偵測 :443 drift → 已自動 reset + 重設 funnel → http://127.0.0.1:8080"
      exit 0
    else
      log "heal 後仍 unhealthy"
      maybe_alert "$prev_state" "$prev_ts" "heal_failed" \
        "🚨 Tripline funnel-guard：偵測 :443 drift，自動 heal 後仍 unhealthy，請手動檢查 \`tailscale serve status\`"
      exit 1
    fi
  else
    log "heal 指令本身失敗"
    maybe_alert "$prev_state" "$prev_ts" "heal_failed" \
      "🚨 Tripline funnel-guard：偵測 :443 drift，\`tailscale funnel\` 指令執行失敗，請手動檢查"
    exit 1
  fi
}

main "$@"
