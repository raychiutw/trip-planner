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

echo
[ $fail -eq 0 ] && { echo "PASS"; exit 0; } || { echo "FAIL"; exit 1; }
