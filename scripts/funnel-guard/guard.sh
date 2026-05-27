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

# 偵測 funnel :443 是否正確路由到 Caddy :8080。
# 三個 layer 都過才算 healthy（v2.33.134 起加 public-side probe）：
#   L1 local: `tailscale serve status --json` AllowFunnel + Proxy 正確
#   L2 DNS:   public resolver (1.1.1.1) 能 resolve funnel hostname
#   L3 reach: HTTPS GET funnel root 回非 0 (TLS handshake + 任何 HTTP response 都行)
#
# v2.33.123 原本只檢 L1，2026-05-27 incident：Tailscale 控制平面 funnel state
# 仍 on，但 public DNS NXDOMAIN → CF Worker 530 + forgot-password 信沒送。L2 加
# 後可立即偵測 + heal 重註冊。
#
# L3 是 belt-and-suspenders — 即使 DNS resolve 也可能 funnel relay 故障 (DERP
# 路徑壞)。HTTPS curl 走全 path 端到端驗。

# Local control-plane state
is_funnel_local_healthy() {
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

# 從 tailscale serve status 取 funnel hostname (e.g. ray-chiudemac-mini.tail2750c0.ts.net)
funnel_hostname() {
  "$TAILSCALE" serve status --json 2>/dev/null \
    | jq -r '(.AllowFunnel // {} | keys[]?) | select(endswith(":443"))' \
    | sed 's/:443$//' | head -1
}

# Multi-resolver fallback：1.1.1.1 / 8.8.8.8 / 9.9.9.9 試到 first 回 IP。
# 2026-05-27 實測 1.1.1.1 對 *.tail2750c0.ts.net 永久 NXDOMAIN 但 8.8.8.8 OK
# (TS DNS upstream 跟 Cloudflare DNS 不對盤 — 也是 CF Worker forgot-password
# 530 的 root cause；CF Worker 也走 Cloudflare 自家 DNS)。
# echoes resolved IP to stdout（caller 用），失敗 echo empty + 非 0 exit。
PUBLIC_RESOLVERS=(1.1.1.1 8.8.8.8 9.9.9.9 208.67.222.222)
funnel_resolve_public() {
  local host="$1" ip ns
  [ -z "$host" ] && return 1
  for ns in "${PUBLIC_RESOLVERS[@]}"; do
    ip=$(dig +short +time=3 +tries=1 "$host" @"$ns" 2>/dev/null | head -1)
    if [ -n "$ip" ]; then
      printf '%s' "$ip"
      return 0
    fi
  done
  return 1
}

is_funnel_public_dns_ok() {
  local host="$1"
  funnel_resolve_public "$host" >/dev/null
}

# End-to-end HTTPS reach via public funnel — 任何 HTTP response (含 4xx) 都算 reachable，
# 只有 curl 本身 exit 非 0 (DNS / TCP / TLS fail) 才視 unhealthy。--resolve 避過
# 本機 MagicDNS，強制走 public IP。10s timeout 涵蓋 DERP relay cold path。
is_funnel_public_reach_ok() {
  local host="$1" ip http_code
  [ -z "$host" ] && return 1
  ip=$(funnel_resolve_public "$host") || return 1
  http_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    --resolve "${host}:443:${ip}" "https://${host}/" 2>/dev/null)
  [[ "$http_code" =~ ^[0-9]{3}$ ]]
}

is_funnel_healthy() {
  is_funnel_local_healthy || { log "L1 local control-plane state 不對"; return 1; }
  local host
  host=$(funnel_hostname)
  if [ -z "$host" ]; then
    log "L1 通過但無 funnel hostname (異常)"
    return 1
  fi
  if ! is_funnel_public_dns_ok "$host"; then
    log "L2 public DNS resolve 失敗 ($host @1.1.1.1)"
    return 1
  fi
  if ! is_funnel_public_reach_ok "$host"; then
    log "L3 HTTPS reach 失敗 ($host — curl 走 public IP 失敗)"
    return 1
  fi
  return 0
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
