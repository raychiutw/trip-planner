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
# 三個 layer 都過才算 healthy：
#   L1 local: `tailscale serve status --json` AllowFunnel + Proxy 正確
#   L2 DNS:   authoritative NS (dnsimple) 有 funnel hostname 的 A record
#   L3 reach: 用 authoritative IP direct HTTPS reach（TLS + 任何 HTTP response 都算通）
#
# v2.33.123 原本只檢 L1，2026-05-27 incident：控制平面 funnel state on 但 public
# DNS NXDOMAIN → CF Worker 530 + forgot-password 信沒送。加 L2/L3 偵測。
#
# 2026-07-05 incident 修正：L2/L3 原本查 recursive resolver (1.1.1.1/8.8.8.8)，但大型
# recursive 對 *.ts.net funnel hostname 反覆 NXDOMAIN — Tailscale 週期性 re-publish
# record 造成極短消失 window → resolver negative-cache 300s（Cloudflare/Google 尤甚，
# Quad9 較穩）。這不代表 funnel drift，卻觸發 heal 的 `serve reset`，reset 瞬間 funnel
# 真的 off → 再製造 negative-cache → self-perpetuating flapping + Telegram noise。
# 改查 authoritative NS（= 控制平面實際發布的真相，不受 recursive cache 污染）：
#   真 drift（控制平面沒發布）→ authoritative 也 NXDOMAIN → 仍偵測到 → heal（正確）
#   假 drift（authoritative 有、只是 recursive cache）→ 判 healthy → 不 heal（正確）

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

# Authoritative resolve：直接問 ts.net 的 authoritative NS (dnsimple)，繞過 recursive
# resolver 的 negative-cache 污染（2026-07-05 incident，見上方 note）。動態取 NS
# delegation 走系統 resolver — 但 NS record 穩定少變（不像 funnel A record 頻繁
# re-publish），故本 incident 的 negative-cache 不影響 NS 查詢；只有 A record 必須
# 走 authoritative。dig 取不到 NS 時 fallback 到已知 dnsimple NS。grep 過濾純 IPv4
# 行（排除 CNAME/雜訊）。echoes first resolved IP；失敗 echo empty + 非 0 exit。
# ponytail: any-one-NS-has-record 即算發布 — dnsimple anycast edge 偶有 serial 落後但
# 只要一個 edge 有 record 就代表控制平面已發布，不因單一 stale edge 誤判 drift。
FALLBACK_NS=(ns1.dnsimple.com ns2.dnsimple-edge.net ns3.dnsimple.com ns4.dnsimple-edge.org)
funnel_resolve_authoritative() {
  local host="$1" ip ns
  [ -z "$host" ] && return 1
  local -a nslist
  # grep 只留合法 NS hostname 行（結尾點）— dig 連線層失敗會把 `;; ...` 診斷印到
  # stdout（非 stderr），不過濾會污染 nslist 導致 fallback 失效。
  nslist=(${(f)"$(dig +short +time=3 +tries=1 NS ts.net 2>/dev/null | grep -E '^[A-Za-z0-9._-]+\.$')"})
  [ ${#nslist[@]} -eq 0 ] && nslist=("${FALLBACK_NS[@]}")
  for ns in "${nslist[@]}"; do
    [ -z "$ns" ] && continue
    ip=$(dig +short +time=3 +tries=1 A "$host" @"$ns" 2>/dev/null | grep -E '^[0-9]+\.[0-9.]+$' | head -1)
    if [ -n "$ip" ]; then
      printf '%s' "$ip"
      return 0
    fi
  done
  return 1
}

# L2：authoritative NS 是否有 funnel hostname 的 A record（= 控制平面已對外發布）
is_funnel_dns_published() {
  local host="$1"
  funnel_resolve_authoritative "$host" >/dev/null
}

# L3：用 authoritative IP direct HTTPS reach — 收到任何真 HTTP response (1xx-5xx，含
# 4xx) 都算 reachable。curl transport fail (TCP refused / TLS / timeout) 時
# %{http_code}=000，必須排除，否則 dead ingress 會被誤判 healthy → 不 heal（codex
# 2026-07-05 抓到的既有 bug）。--resolve 強制走該 IP，避過本機 MagicDNS 與 recursive
# 污染。10s timeout 涵蓋 DERP relay cold path。
# 失敗細節存 REACH_DETAIL（ip / curl exit / http_code）供 caller log — 2026-07-07
# 型態 D 事後只有「reach 失敗」四個字，診斷靠猜。
is_funnel_reach_ok() {
  local host="$1" ip http_code curl_exit
  [ -z "$host" ] && return 1
  ip=$(funnel_resolve_authoritative "$host") || { REACH_DETAIL="authoritative resolve failed"; return 1; }
  http_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    --resolve "${host}:443:${ip}" "https://${host}/" 2>/dev/null)
  curl_exit=$?
  REACH_DETAIL="ip=${ip} curl_exit=${curl_exit} http_code=${http_code:-none}"
  [[ "$http_code" =~ ^[1-5][0-9]{2}$ ]]
}

# L3 短暫 blip 重試間隔（秒）。2026-07-07 型態 D incident：Tailscale edge 33 秒
# 瞬斷（L1 serve state 與 L2 authoritative DNS 全程正常，只 L3 direct reach 失敗
# 後自癒），舊邏輯單次 fail 立刻 heal — 3 輪無效 serve reset（reset 瞬間 funnel
# 真 off 反而小幅加重）+ heal_failed Telegram 噪音。test-guard.sh 覆寫成 0 加速。
L3_RETRY_INTERVAL="${L3_RETRY_INTERVAL:-15}"

# $1 = L3 最大嘗試次數（預設 3）。heal 後重驗傳 1 — heal 剛做完只需驗「有沒有
# 生效」，再跑完整 retry 會把 sustained-outage 的 heal_failed 警報延到 ~125s，
# 超過 launchd 120s interval（codex review P1）。
is_funnel_healthy() {
  local max_attempts="${1:-3}"
  is_funnel_local_healthy || { log "L1 local control-plane state 不對"; return 1; }
  local host
  host=$(funnel_hostname)
  if [ -z "$host" ]; then
    log "L1 通過但無 funnel hostname (異常)"
    return 1
  fi
  if ! is_funnel_dns_published "$host"; then
    log "L2 authoritative DNS 無 record ($host — 控制平面未發布，真 drift)"
    return 1
  fi
  # L3 blip 容忍（型態 D）：L1/L2 綠時 L3 fail 先重試確認持續（間隔
  # L3_RETRY_INTERVAL，共跨 ~30s）才判 unhealthy。edge 瞬斷自癒 → 0 heal
  # 0 噪音；型態 B（持續 TLS stall）全 fail → 照樣 heal。
  local attempt
  for (( attempt=1; attempt<=max_attempts; attempt++ )); do
    if is_funnel_reach_ok "$host"; then
      [ "$attempt" -gt 1 ] && log "L3 重試第 $attempt 次通過 — 短暫 blip 自癒，不 heal"
      return 0
    fi
    log "L3 HTTPS reach 失敗 ($host — ${REACH_DETAIL:-no detail}, attempt $attempt/$max_attempts)"
    [ "$attempt" -lt "$max_attempts" ] && sleep "$L3_RETRY_INTERVAL"
  done
  return 1
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
    # 單次驗（不 retry）：只驗 heal 有沒有生效，避免 sustained outage 的
    # heal_failed 警報被 retry 窗拖過 launchd 120s interval
    if is_funnel_healthy 1; then
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

# GUARD_SOURCE_ONLY=1 → 只載入函式不跑 main（供 test harness / 手動驗證 source，
# 避免觸發 heal 的 serve reset 與 Telegram alert）
if [ "${GUARD_SOURCE_ONLY:-}" != "1" ]; then
  main "$@"
fi
