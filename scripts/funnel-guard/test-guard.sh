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

echo "[6] 多 edge fallback（2026-09-01 incident：head -1 單 edge 誤報 159 次 / 36 次無效 heal）"
# 行為測試（非 source-grep）：source-grep 抓不到「第一個 edge 不通就 break」這類
# 退化 — mutation 實測 source-grep 對它全綠，只有真的跑起來才會紅。
if [ -n "$host" ]; then
  # 此時 funnel_resolve_authoritative 已被 [5] mock，直接 dig 取真實 edge
  good_ip=$(dig +short +time=3 +tries=1 A "$host" @ns1.dnsimple.com 2>/dev/null | grep -E '^[0-9]+\.[0-9.]+$' | tail -1)
  if [ -z "$good_ip" ]; then
    skip "無法取得真實 edge IP — 跳過多 edge 驗證"
  else
    # 壞 edge 排在前：舊版 head -1 只會探到它 → 誤判整個 funnel 壞。
    # 127.0.0.1:443 無 listener → 立即 refused（比不可路由 IP 快，同樣 http_code=000）
    funnel_resolve_authoritative() { printf '127.0.0.1\n%s' "$good_ip"; }
    if is_funnel_reach_ok "$host"; then
      ok "一壞一好 → healthy（單 edge 抖動不再誤觸發 heal）"
      if [ -n "${REACH_DEGRADED:-}" ]; then
        ok "降級已記錄可觀測 ($REACH_DEGRADED)"
      else
        bad "REACH_DEGRADED 未記錄 — 單一 edge 長期劣化會看不見"
      fi
    else
      bad "單一 edge 不通即判整個 funnel 壞 → 誤觸發無效 heal（head -1 / break 回歸？）"
    fi
    # 防恆真：全 edge 不通仍須 unhealthy，否則真故障漏偵測
    funnel_resolve_authoritative() { printf '127.0.0.1\n127.0.0.2'; }
    if is_funnel_reach_ok "$host"; then
      bad "全 edge 不通卻判 healthy — 恆真，真故障漏偵測"
    else
      ok "全 edge 不通 → unhealthy（真故障仍偵測得到）"
    fi
    # 重複 A record 不得讓探測時間翻倍（codex adversarial #2）
    funnel_resolve_authoritative() { printf '127.0.0.1\n127.0.0.1\n127.0.0.1'; }
    is_funnel_reach_ok "$host" >/dev/null
    dup_probes=$(printf '%s' "${REACH_DETAIL:-}" | grep -o 'ip=' | wc -l | tr -d ' ')
    if [ "$dup_probes" -eq 1 ]; then
      ok "重複 A record 去重（3 個相同 IP 只探 1 次）"
    else
      bad "重複 A record 探了 $dup_probes 次 — 沒去重，惡意/異常 DNS 可拖長單輪執行"
    fi

    # REACH_DEGRADED 不得跨呼叫殘留：先製造降級值，再走 resolve-fail 的 early
    # return，殘值會讓 caller 對著上一輪的 edge 狀態發 log。
    funnel_resolve_authoritative() { printf '127.0.0.1\n%s' "$good_ip"; }
    is_funnel_reach_ok "$host" >/dev/null
    funnel_resolve_authoritative() { return 1; }
    is_funnel_reach_ok "$host" >/dev/null
    if [ -n "${REACH_DEGRADED:-}" ]; then
      bad "REACH_DEGRADED 殘留上一輪的值 ($REACH_DEGRADED) — early return 沒清"
    else
      ok "REACH_DEGRADED 每次呼叫先清（early return 路徑也清）"
    fi
  fi
else
  skip "no funnel hostname — 跳過多 edge 驗證"
fi

echo "[7] L3 blip 容忍（2026-07-07 型態 D）— fail→pass 判 healthy；持續 fail 仍 unhealthy"
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
