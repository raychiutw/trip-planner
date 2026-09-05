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
# 用固定 mock hostname：這條只需要「本機 :443 沒有 listener」，不需要真的有 funnel，
# 所以不再包在 host 條件裡而在無 funnel 的機器上被跳過（同 [6] 的 skip 假綠問題）。
if true; then
  host="mock-host.ts.net"
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

echo "[6] 多 edge fallback（全 mock probe seam — 任何環境都真的跑得到）"
# 2026-09-04 codex adversarial：舊版整段包在「有真 funnel hostname」的條件裡，沒有
# funnel 的機器（CI／sandbox）會 skip 卻照樣回報 PASS —— skip 也是一種假綠。改成覆寫
# probe_edge_http_code seam，不依賴真 funnel、不依賴網路。
_mock_host="mock-host.ts.net"
probe_edge_http_code() {
  case "$1" in
    10.0.0.1) printf '404'; return 0 ;;   # 可達
    *)        printf '000'; return 28 ;;  # timeout
  esac
}

funnel_resolve_authoritative() { printf '10.0.0.9\n10.0.0.1'; }
if is_funnel_reach_ok "$_mock_host"; then
  ok "一壞一好（壞的在前）→ healthy，不誤觸發 heal"
  if [ -n "${REACH_DEGRADED:-}" ]; then
    ok "降級已記錄 ($REACH_DEGRADED)"
  else
    bad "REACH_DEGRADED 未記錄 — 單一 edge 長期劣化會看不見"
  fi
else
  bad "單一 edge 不通即判整個 funnel 壞（head -1 / break 回歸？）"
fi

# 好的排前面 → 命中即早退，後面的壞 edge 不會被探到，REACH_DEGRADED 必為空。
# 這是刻意取捨：heal 只需要知道「有沒有任一條通」，探完全部會讓最壞時間翻倍。代價是
# 降級診斷只涵蓋「排在可用 edge 之前」的壞 edge。鎖住這個語意，避免日後有人把
# REACH_DEGRADED 當成完整的 edge 健康度。
funnel_resolve_authoritative() { printf '10.0.0.1\n10.0.0.9'; }
if is_funnel_reach_ok "$_mock_host"; then
  if [ -z "${REACH_DEGRADED:-}" ]; then
    ok "好的在前 → 早退且 REACH_DEGRADED 空（已知取捨，非完整 edge 健康度）"
  else
    bad "好的在前卻記了降級 — 早退語意變了，時間預算的假設也跟著失效"
  fi
else
  bad "第一個 edge 就通卻判 unhealthy"
fi

funnel_resolve_authoritative() { printf '10.0.0.8\n10.0.0.9'; }
if is_funnel_reach_ok "$_mock_host"; then
  bad "全 edge 不通卻判 healthy — 恆真，真故障漏偵測"
else
  ok "全 edge 不通 → unhealthy（真故障仍偵測得到）"
fi

funnel_resolve_authoritative() { printf '10.0.0.9\n10.0.0.9\n10.0.0.9'; }
is_funnel_reach_ok "$_mock_host" >/dev/null
dup_probes=$(printf '%s' "${REACH_DETAIL:-}" | grep -o 'ip=' | wc -l | tr -d ' ')
if [ "$dup_probes" -eq 1 ]; then
  ok "重複 A record 去重（3 個相同 IP 只探 1 次）"
else
  bad "重複 A record 探了 $dup_probes 次 — 沒去重"
fi

funnel_resolve_authoritative() { printf '10.0.0.9\n10.0.0.1'; }
is_funnel_reach_ok "$_mock_host" >/dev/null
funnel_resolve_authoritative() { return 1; }
is_funnel_reach_ok "$_mock_host" >/dev/null
if [ -n "${REACH_DEGRADED:-}" ]; then
  bad "REACH_DEGRADED 殘留上一輪的值 ($REACH_DEGRADED) — early return 沒清"
else
  ok "REACH_DEGRADED 每次呼叫先清（early return 路徑也清）"
fi

echo "[7] resolve 真的回傳多行（擋掉所有『只取第一筆』的變體寫法）"
# [6] 結尾把 funnel_resolve_authoritative mock 成 return 1，這裡要拿回真的實作
GUARD_SOURCE_ONLY=1 source scripts/funnel-guard/guard.sh 2>/dev/null
# coverage 稽核指出：unit test 只禁止字面的 `head -1`，換成 head -n1／tail -1／
# sed -n 1p 都能繞過 source-grep 而重現 2026-09-01 incident。這裡覆寫 dig 直接數行數，
# 任何截斷寫法都會讓行數掉到 1 而變紅。
dig() {
  case "$*" in
    *"NS ts.net"*)          printf 'ns1.dnsimple.com.\n' ;;
    *"A mock-multi.ts.net"*) printf '10.0.0.1\n10.0.0.2\n10.0.0.3\n' ;;
    *)                       printf '' ;;
  esac
}
_resolved=$(funnel_resolve_authoritative "mock-multi.ts.net")
_lines=$(printf '%s\n' "$_resolved" | grep -c '^10\.0\.0\.')
if [ "$_lines" -eq 3 ]; then
  ok "resolve 回傳全部 3 筆 A record（沒有被任何形式截斷）"
else
  bad "resolve 只回傳 $_lines 筆 — 有截斷（head -1／head -n1／tail -1／sed 1p 之類）"
fi
unset -f dig

echo "[8] is_funnel_healthy 端到端接線：REACH_DEGRADED 要真的觸發 log"
# testing specialist 用 mutation 證明的缺口：把 213 行守衛變數打錯字（log 字串不動），
# source-grep 8 條斷言全綠、test-guard.sh 也全 PASS —— 因為 [6] 只直測
# is_funnel_reach_ok，[9] 又把它整個 mock 掉，沒有任何案例讓真的 is_funnel_reach_ok
# 流經 is_funnel_healthy。這裡保留真的 is_funnel_reach_ok，只 mock 它下游的探測。
is_funnel_local_healthy() { return 0; }
funnel_hostname() { printf 'mock-host.ts.net'; }
is_funnel_dns_published() { return 0; }
probe_edge_http_code() {
  case "$1" in
    10.0.0.1) printf '404'; return 0 ;;
    *)        printf '000'; return 28 ;;
  esac
}
funnel_resolve_authoritative() { printf '10.0.0.9\n10.0.0.1'; }
_out=$(is_funnel_healthy 2>&1)
if printf '%s' "$_out" | grep -q '部分 edge 不可達但服務仍可達'; then
  ok "is_funnel_healthy 真的印出降級 log（寫入→消費的接線完整）"
else
  bad "is_funnel_healthy 沒印出降級 log — REACH_DEGRADED 接線斷了（直測 is_funnel_reach_ok 看不到這種回歸）"
fi
# 反向：沒有降級時不可誤印（擋 -n 改成 -z、或把 log 移出成功分支而每次都噴）
funnel_resolve_authoritative() { printf '10.0.0.1'; }
_out2=$(is_funnel_healthy 2>&1)
if printf '%s' "$_out2" | grep -q '部分 edge 不可達但服務仍可達'; then
  bad "沒有降級卻印了降級 log — 條件寫反或 log 放錯分支"
else
  ok "無降級時不印降級 log（條件方向正確）"
fi

echo "[9] L3 blip 容忍（2026-07-07 型態 D）— fail→pass 判 healthy；持續 fail 仍 unhealthy"
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
