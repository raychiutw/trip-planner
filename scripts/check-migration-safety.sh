#!/usr/bin/env bash
# scripts/check-migration-safety.sh — pre-deploy gate against D1 cascade wipeout
#
# 2026-05-04 incident: migration 0047 用 PRAGMA foreign_keys = OFF + DROP TABLE trips
# 預期會抑制 ON DELETE CASCADE，但 D1 不 honor cross-statement PRAGMA → CASCADE 觸發
# → 全 prod trip_days/entries/pois/destinations/docs 砍光。
#
# 此 script 掃描 migrations/ 找「DROP TABLE <parent>」+ children 用「REFERENCES <parent>」
# 的危險 pattern，要求 migration 必含 `_backup_` 字樣（backup-restore pattern 標記）。
#
# Usage:
#   bash scripts/check-migration-safety.sh                    # check ALL (informational)
#   bash scripts/check-migration-safety.sh --since=<ref>      # gate mode (block on NEW)
# CI 傳的是 github.event.before（真正的 push 前 tip）—— 見 .github/workflows/deploy.yml。
# 不要用固定回看一格的 origin/master~1：一次推多個 commit 就會漏看前面幾格。
#
# Exit codes:
#   0 = PASS（無不安全的 NEW migration）
#   1 = 不安全 NEW migration；CI 用此 exit code block deploy
#   2 = gate 本身跑不起來（--since ref 解不開 / 未知參數）—— 不是「安全」，是「沒檢查」
# 早於 --since 的 migration 只 WARN（假定已套用 —— 本 script 不查 d1_migrations）。
#
# 行為（含 exit 2 那條）由 tests/unit/check-migration-safety.test.ts 鎖住，
# 該檔的 docblock 也記著這個 gate 為何曾經從未擋下任何東西。改本檔請同步跑它。

set -euo pipefail

MIGRATIONS_DIR="migrations"
SINCE_REF=""
EXIT_CODE=0

# Parse args
for arg in "$@"; do
  case "$arg" in
    --since=*) SINCE_REF="${arg#--since=}" ;;
    --dir=*)   MIGRATIONS_DIR="${arg#--dir=}" ;;
    *)         echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

echo "🛡️  D1 migration safety check — scanning $MIGRATIONS_DIR/"
[ -n "$SINCE_REF" ] && echo "   Gate mode: NEW migrations vs $SINCE_REF"
echo ""

# 掃不到任何東西 ≠ 沒有東西可掃：錯的 --dir / sparse checkout 會讓下面的 glob 靜默
# 展不開 → CASCADE_PARENTS 空 → 「無 CASCADE 關聯」→ exit 0。那是沒檢查，不是安全。
if [ ! -d "$MIGRATIONS_DIR" ] || ! ls "$MIGRATIONS_DIR"/*.sql >/dev/null 2>&1; then
  echo "❌ GATE BROKEN: '$MIGRATIONS_DIR/' 不存在或沒有任何 .sql。" >&2
  echo "   Refusing to report PASS on a scan that had nothing to scan." >&2
  exit 2
fi

# Build NEW migration filenames (newline-separated, bash 3 friendly)
NEW_FILES=""
if [ -n "$SINCE_REF" ]; then
  # Empty NEW_FILES must mean "no .sql changed", never "the ref didn't resolve".
  if ! git rev-parse --verify --quiet "${SINCE_REF}^{commit}" >/dev/null 2>&1; then
    echo "❌ GATE BROKEN: --since ref '$SINCE_REF' is unreachable." >&2
    echo "   Refusing to report PASS on a comparison that cannot run." >&2
    echo "   In CI this means the checkout is too shallow — give actions/checkout a" >&2
    echo "   fetch-depth that covers '$SINCE_REF' (.github/workflows/deploy.yml)." >&2
    exit 2
  fi
  # git must NOT be wrapped in `2>/dev/null || true` (set -e has to see it fail);
  # grep must be, because "no .sql changed" is a legitimate empty result.
  CHANGED=$(git diff --name-only --diff-filter=AM "$SINCE_REF"...HEAD -- "$MIGRATIONS_DIR/")
  NEW_FILES=$(echo "$CHANGED" | grep '\.sql$' | xargs -n1 basename 2>/dev/null || true)
  COUNT=$(echo "$NEW_FILES" | grep -c '\.sql$' || true)  # `|| echo 0` would print a 2nd 0
  echo "📋 NEW/modified migrations vs $SINCE_REF: $COUNT"
  [ -n "$NEW_FILES" ] && echo "$NEW_FILES" | sed 's/^/   - /'
  echo ""
fi

# is_new() helper — checks if basename in NEW_FILES list
is_new() {
  [ -z "$SINCE_REF" ] && return 0  # no gate mode → treat all as new (errors only when no --since)
  echo "$NEW_FILES" | grep -qx "$1"
}

# Build list of parents that have CASCADE children (across ALL migrations)。
# 逐「敘述」掃（壓掉換行再以 `;` 切）而非逐「行」：FOREIGN KEY / REFERENCES /
# ON DELETE CASCADE 分寫三行是合法 SQL，逐行 grep 抓不到就會放行一個 DROP TABLE。
# 取敘述內每一個 REFERENCES（非 head -1）：寧可多擋，不可漏一個而砍光 prod。
declare -a CASCADE_PARENTS=()
while IFS= read -r parent; do
  if [ -n "$parent" ]; then
    if [[ ! " ${CASCADE_PARENTS[*]:-} " =~ " ${parent} " ]]; then
      CASCADE_PARENTS+=("$parent")
    fi
  fi
done < <(
  cat "$MIGRATIONS_DIR"/*.sql \
    | tr '\n' ' ' \
    | tr ';' '\n' \
    | grep -E 'ON[[:space:]]+DELETE[[:space:]]+CASCADE' \
    | grep -oE 'REFERENCES[[:space:]]+[a-z_]+' \
    | awk '{print $2}' \
    || true
)

if [ ${#CASCADE_PARENTS[@]} -eq 0 ]; then
  echo "ℹ️  No CASCADE FK relationships detected in schema — skip check."
  exit 0
fi

echo "📋 Tables with CASCADE children (DROP risk):"
for p in "${CASCADE_PARENTS[@]}"; do
  echo "   - $p"
done
echo ""

UNSAFE_NEW=0
UNSAFE_HISTORICAL=0

# Scan each migration for DROP TABLE on cascade-parent
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  base=$(basename "$migration")

  for parent in "${CASCADE_PARENTS[@]}"; do
    if grep -qE "DROP[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?${parent}([[:space:]]*;|[[:space:]]+RENAME)" "$migration"; then
      if ! grep -qE "_backup_${parent}|_backup_trip_" "$migration"; then
        if [ -n "$SINCE_REF" ] && ! is_new "$base"; then
          # 「早於 --since」≠「已套用到 prod」—— 本 script 不查 d1_migrations。已知缺口：
          # 被擋下的不安全 migration（exit 1、apply 沒跑）只要之後再落地一個動到
          # migrations/ 的 commit，就會降級成這條 WARN 然後被套下去。權威來源是
          # `wrangler d1 migrations list --remote --env production`，接上它是 follow-up。
          echo "⚠️  PRE-EXISTING UNSAFE: $base"
          echo "   - DROP TABLE \`$parent\` without backup-restore"
          # ${SINCE_REF} 的大括號不可省：後接全形「；」會被吃進變數名 → set -u 崩。
          echo "   - 早於 ${SINCE_REF}；假定已套用（未對 d1_migrations 查證）"
          echo ""
          UNSAFE_HISTORICAL=$((UNSAFE_HISTORICAL + 1))
        else
          # NEW migration or no gate mode — ERROR
          echo "❌ UNSAFE NEW: $base"
          echo "   - DROP TABLE \`$parent\` 觸發 ON DELETE CASCADE 砍光所有 children"
          echo "   - 缺少 _backup_* pattern — D1 不 honor PRAGMA foreign_keys = OFF"
          echo "   - 修法：先 CREATE TABLE _backup_<children> AS SELECT * FROM <children>;"
          echo "          做 swap 後 INSERT children back from backup; DROP backup;"
          echo "   - Reference: 2026-05-04 prod incident, see 0047 fixed version"
          echo ""
          UNSAFE_NEW=$((UNSAFE_NEW + 1))
          EXIT_CODE=1
        fi
      else
        echo "✅ SAFE: $base (DROP TABLE $parent + uses _backup_ pattern)"
      fi
    fi
  done
done

echo ""
echo "════════════════════════════════════"
echo "Summary: NEW unsafe=$UNSAFE_NEW, historical unsafe=$UNSAFE_HISTORICAL"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ PASS — no NEW migration risks D1 CASCADE wipe."
else
  echo "❌ FAIL — at least one NEW migration risks D1 CASCADE wipe. Block deploy."
fi

exit $EXIT_CODE
