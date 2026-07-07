#!/bin/zsh
# test-guard.sh — funnel-guard 健康判定邏輯的本機 self-check。
#
# 非 CI：依賴 dig + 網路 + 當前 funnel 狀態（guard.sh 本身是 mac mini 本機 launchd
# ops script，同樣不在 CI 範圍）。手動跑：
#   zsh scripts/funnel-guard/test-guard.sh
#
# 覆蓋 2026-07-05 incident 修正的核心不變量：
#   - 健康判定走 authoritative NS（不碰 recursive resolver，免 negative-cache 誤導）
#   - 真 drift（authoritative 也無 record）仍偵測得到 → 不因修正而漏 heal
set -uo pipefail
cd "$(dirname "$0")/../.."

fail=0
ok()   { echo "  ✅ $1"; }
bad()  { echo "  ❌ $1"; fail=1; }
skip() { echo "  ⏭️  $1"; }

echo "[1] syntax"
zsh -n scripts/funnel-guard/guard.sh && ok "guard.sh parses" || bad "syntax error"

echo "[2] load lib (GUARD_SOURCE_ONLY=1 → 不跑 main，無 heal/telegram 副作用)"
GUARD_SOURCE_ONLY=1 source scripts/funnel-guard/guard.sh 2>/dev/null
set +e
typeset -f funnel_resolve_authoritative >/dev/null && ok "funnel_resolve_authoritative loaded" || bad "fn missing"
[ ${#FALLBACK_NS[@]} -ge 1 ] && ok "FALLBACK_NS non-empty (${#FALLBACK_NS[@]})" || bad "FALLBACK_NS empty"

echo "[3] authoritative resolve — real funnel host (precondition for [4])"
host=$(funnel_hostname)
if [ -z "$host" ]; then
  skip "funnel off (no hostname) — 跳過 resolve / drift 驗證"
else
  real_ip=$(funnel_resolve_authoritative "$host")
  if [ -n "$real_ip" ]; then
    ok "real host $host -> $real_ip"
    echo "[4] real-drift detection — nonexistent host must NOT resolve"
    fake="nonexistent-$$-xyz.${host#*.}"
    if funnel_resolve_authoritative "$fake" >/dev/null; then
      bad "false-positive: $fake resolved → 會漏掉真 drift"
    else
      ok "$fake 無 record → 真 drift 仍偵測得到"
    fi
  else
    skip "real host 無法 resolve (funnel off / 無網路) — 跳過 drift 驗證"
  fi
fi

echo "[5] L3 transport-fail (curl http_code=000) must NOT count as healthy"
if [ -n "$host" ]; then
  # mock resolve → 127.0.0.1:443（本機無 https listen → curl connection refused →
  # http_code=000）。regex 若含 000 會把 dead ingress 誤判 healthy。
  funnel_resolve_authoritative() { printf '127.0.0.1'; }
  if is_funnel_reach_ok "$host"; then
    bad "127.0.0.1:443 判 reachable — 000/refused 被當 healthy (false-healthy)"
  else
    ok "unreachable ingress (000) → unhealthy（正確排除 transport fail）"
  fi
else
  skip "no funnel hostname — 跳過 L3 000 驗證"
fi

echo "[6] L3 blip 容忍（2026-07-07 型態 D）— fail→pass 判 healthy；持續 fail 仍 unhealthy"
# 全 mock：只驗 is_funnel_healthy 的 L3 retry 分支，不碰網路/真 funnel
L3_RETRY_INTERVAL=0
is_funnel_local_healthy() { return 0; }
funnel_hostname() { printf 'mock-host.ts.net'; }
is_funnel_dns_published() { return 0; }
_reach_calls=0
is_funnel_reach_ok() { _reach_calls=$((_reach_calls+1)); [ "$_reach_calls" -ge 2 ]; }
if is_funnel_healthy >/dev/null 2>&1; then
  ok "blip（首次 fail、重試 pass）→ healthy，不觸發 heal"
else
  bad "blip 被判 unhealthy — 短暫 edge 瞬斷仍會白 heal + 發噪音"
fi
_reach_calls=0
is_funnel_reach_ok() { _reach_calls=$((_reach_calls+1)); return 1; }
if is_funnel_healthy >/dev/null 2>&1; then
  bad "持續 fail 判 healthy — 型態 B（TLS stall）會漏 heal"
else
  if [ "$_reach_calls" -eq 3 ]; then
    ok "持續 fail → unhealthy 且恰好 3 次 probe（型態 B heal 照舊、retry 預算正確）"
  else
    bad "持續 fail probe 次數 $_reach_calls ≠ 3 — retry 預算跑偏"
  fi
fi
_reach_calls=0
if is_funnel_healthy 1 >/dev/null 2>&1; then
  bad "單次模式（heal 後重驗）判 healthy — mock 應 fail"
else
  if [ "$_reach_calls" -eq 1 ]; then
    ok "is_funnel_healthy 1 恰好 1 次 probe（heal 後重驗不 double retry 窗）"
  else
    bad "單次模式 probe 次數 $_reach_calls ≠ 1"
  fi
fi

echo
[ $fail -eq 0 ] && { echo "PASS"; exit 0; } || { echo "FAIL"; exit 1; }
