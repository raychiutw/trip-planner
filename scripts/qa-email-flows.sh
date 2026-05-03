#!/usr/bin/env bash
# scripts/qa-email-flows.sh — 端到端驗 prod 發信功能
#
# 涵蓋 5 條 email-send paths (見 .gstack/qa-reports/qa-report-email-flows-2026-05-03.md):
#   1. POST /api/oauth/forgot-password      → reset link email
#   2. POST /api/oauth/send-verification    → verify link email
#   3. POST /api/oauth/reset-password       → password-changed confirm email
#   4. POST /api/permissions                → trip invitation email
#   5. POST /api/requests                   → admin notification email
#
# 本腳本 cover #1 #2 (anti-enum 兩種 case) + health probe。
# #3 #4 #5 涉及修改真實資料/邀請別人,不在腳本內 live test。
#
# 全部 email 走 mac mini Gmail SMTP (TRIPLINE_API_URL Tailscale Funnel)。
#
# Usage:
#   ./scripts/qa-email-flows.sh             # dry-run (only health probe + 不存在 email path)
#   ./scripts/qa-email-flows.sh --send      # 真寄一封 reset email 到 admin (lean.lean@gmail.com)
#   ./scripts/qa-email-flows.sh --base http://localhost:8788 --send  # 本機測 (需 .dev.vars 設 TRIPLINE_API_URL)
#
# Env overrides (CLI flag 永遠覆蓋 env):
#   TRIPLINE_QA_BASE        — default https://trip-planner-dby.pages.dev
#   TRIPLINE_QA_ADMIN_EMAIL — default lean.lean@gmail.com
#
# Exit codes: 0 = all pass, 1 = any fail

set -euo pipefail

BASE="${TRIPLINE_QA_BASE:-https://trip-planner-dby.pages.dev}"
SEND_REAL=0
ADMIN_EMAIL="${TRIPLINE_QA_ADMIN_EMAIL:-lean.lean@gmail.com}"
NONEXISTENT_EMAIL="qa-nonexistent-$(date +%s)@example.invalid"

usage() {
  sed -n '2,30p' "$0"
  exit "${1:-0}"
}

require_arg() {
  # require_arg <flag> <next-arg-count>
  if [ "$2" -lt 2 ]; then
    echo "ERROR: $1 needs a value" >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --send) SEND_REAL=1 ;;
    --base) require_arg "$1" "$#"; shift; BASE="$1" ;;
    --admin-email) require_arg "$1" "$#"; shift; ADMIN_EMAIL="$1" ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 2 ;;
  esac
  shift
done

# Validate BASE (https:// 或 http://localhost — 拒 file://, http://任意外部)
if ! printf '%s' "$BASE" | grep -qE '^(https://|http://localhost(:[0-9]+)?(/|$))'; then
  echo "ERROR: --base must be https:// or http://localhost[:port]; got: $BASE" >&2
  exit 2
fi

# --send + 非 admin email = 拒。避免誤打到第三方 email (anti-enum 200 後 prod 會
# 真的寄一封 reset 信過去,屬於 weaponized abuse)。
if [ "$SEND_REAL" = "1" ] && [ "$ADMIN_EMAIL" != "lean.lean@gmail.com" ]; then
  echo "ERROR: --send requires ADMIN_EMAIL == lean.lean@gmail.com (got: $ADMIN_EMAIL)" >&2
  echo "  改用 dry-run mode (拿掉 --send) 才能對任意 email 試 anti-enum path" >&2
  exit 2
fi

# 用 mktemp 避免並行跑時 /tmp/qa-email-resp.txt race
RESP_FILE=$(mktemp /tmp/qa-email-resp.XXXXXXXX)
trap 'rm -f "$RESP_FILE"' EXIT

PASS=0
FAIL=0
RESULTS=()

cyan() { printf '\033[1;36m%s\033[0m\n' "$1"; }
green() { printf '\033[0;32m%s\033[0m' "$1"; }
red()   { printf '\033[0;31m%s\033[0m' "$1"; }

# Run one HTTP test. Args: name, expected_status, method, path, [body]
run_test() {
  local name="$1" expected="$2" method="$3" path="$4" body="${5:-}"
  local url="${BASE}${path}"
  local resp http_code body_part

  if [ -n "$body" ]; then
    resp=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" \
      -H 'Content-Type: application/json' \
      --data "$body" "$url" 2>&1) || true
  else
    resp=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$url" 2>&1) || true
  fi
  http_code="$resp"
  body_part=$(head -c 300 "$RESP_FILE" 2>/dev/null)

  printf '  → '
  if [ "$http_code" = "$expected" ]; then
    green '✓ PASS'
    PASS=$((PASS+1))
    RESULTS+=("PASS $name [$http_code]")
  else
    red '✗ FAIL'
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL $name [expected $expected, got $http_code]")
  fi
  printf '  %s %s → HTTP %s\n' "$method" "$url" "$http_code"
  printf '  body: %s\n\n' "$body_part"
}

cyan "═══ Tripline Email Flows QA ═══"
echo "Base: $BASE"
echo "Admin email: $ADMIN_EMAIL"
echo "Send real emails: $([ $SEND_REAL -eq 1 ] && echo 'YES (will hit your inbox)' || echo 'NO (--send to enable)')"
echo

cyan "[1/5] Health probe — /api/public-config 應 emailVerification=true"
run_test "public-config emailVerification flag" 200 GET "/api/public-config"
if grep -q '"emailVerification":true' "$RESP_FILE" 2>/dev/null; then
  printf '  → '; green '✓ emailVerification=true (TRIPLINE_API_URL 已設)'; echo
else
  printf '  → '; red '✗ emailVerification=false — TRIPLINE_API_URL 缺/錯,後續測試會 500'; echo
  FAIL=$((FAIL+1))
  RESULTS+=("FAIL emailVerification flag")
fi
echo

cyan "[2/5] Forgot-password 不存在 email — anti-enum 應回 200 generic + 不寄信"
run_test "forgot-password unknown email (anti-enum)" 200 POST "/api/oauth/forgot-password" \
  "{\"email\":\"${NONEXISTENT_EMAIL}\"}"

cyan "[3/5] Send-verification 不存在 email — anti-enum 應回 200 generic + 不寄信"
run_test "send-verification unknown email (anti-enum)" 200 POST "/api/oauth/send-verification" \
  "{\"email\":\"${NONEXISTENT_EMAIL}\"}"

cyan "[4/5] Send-verification admin (already verified) — 應回 200 silent + 不寄信"
run_test "send-verification already-verified user" 200 POST "/api/oauth/send-verification" \
  "{\"email\":\"${ADMIN_EMAIL}\"}"

if [ $SEND_REAL -eq 1 ]; then
  cyan "[5/5] Forgot-password admin — 真寄 reset email 到 ${ADMIN_EMAIL}"
  echo "  ⚠️  將寄真信到 admin inbox; rate limit 3/h 注意。"
  run_test "forgot-password admin (REAL SEND)" 200 POST "/api/oauth/forgot-password" \
    "{\"email\":\"${ADMIN_EMAIL}\"}"
  if grep -q '"ok":true' "$RESP_FILE" 2>/dev/null; then
    printf '  → '; green '✓ 200 ok=true; '; echo "請於 1-2 分鐘內檢查 ${ADMIN_EMAIL} inbox"
    echo '    若未到 → 看 mac mini scripts/logs/api-server.log + Telegram bot alert'
  fi
else
  cyan "[5/5] SKIPPED — 加 --send 才寄真信 (避免 spam admin inbox)"
fi

echo
cyan "═══ Summary ═══"
printf '  Pass: '; green "$PASS"; echo
printf '  Fail: '; red "$FAIL"; echo
echo
if [ "${#RESULTS[@]}" -gt 0 ]; then
  for r in "${RESULTS[@]}"; do
    echo "  $r"
  done
fi
echo

if [ $FAIL -gt 0 ]; then exit 1; fi
exit 0
