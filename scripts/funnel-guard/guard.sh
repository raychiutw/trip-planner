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

# v2.33.124：state-transition / throttle 改用共用 helper scripts/lib/throttled-alert.sh
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/throttled-alert.sh"

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

main() {
  # M1 kill-switch：incident response 時 `touch .disabled` 暫停 auto-heal
  if [ -f "$KILL_SWITCH" ]; then
    log "kill-switch (.disabled) present — 跳過 heal"
    exit 0
  fi

  if is_funnel_healthy; then
    log "healthy"
    throttled_alert "funnel-guard" "healthy" \
      "🛡️ Tripline funnel-guard：funnel 已恢復 healthy" 2>&1 | sed "s/^/$LOG_PREFIX  /" || true
    exit 0
  fi

  log "drift 偵測 — 開始 heal"
  if heal_funnel; then
    # 5s 等 tailscaled converge + DERP relay reconnect
    sleep 5
    if is_funnel_healthy; then
      log "heal 成功"
      throttled_alert "funnel-guard" "healed" \
        "🛡️ Tripline funnel-guard：偵測 :443 drift → 已自動 reset + 重設 funnel → http://127.0.0.1:8080" \
        2>&1 | sed "s/^/$LOG_PREFIX  /" || true
      exit 0
    else
      log "heal 後仍 unhealthy"
      throttled_alert "funnel-guard" "heal_failed" \
        "🚨 Tripline funnel-guard：偵測 :443 drift，自動 heal 後仍 unhealthy，請手動檢查 \`tailscale serve status\`" \
        2>&1 | sed "s/^/$LOG_PREFIX  /" || true
      exit 1
    fi
  else
    log "heal 指令本身失敗"
    throttled_alert "funnel-guard" "heal_failed" \
      "🚨 Tripline funnel-guard：偵測 :443 drift，\`tailscale funnel\` 指令執行失敗，請手動檢查" \
      2>&1 | sed "s/^/$LOG_PREFIX  /" || true
    exit 1
  fi
}

main "$@"
