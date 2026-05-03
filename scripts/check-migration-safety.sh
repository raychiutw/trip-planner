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
#   bash scripts/check-migration-safety.sh                  # check ALL (informational)
#   bash scripts/check-migration-safety.sh --since=origin/master  # CI gate (block on NEW)
#
# 退出 1 = 不安全 NEW migration；CI 用此 exit code block deploy。
# 已 applied 歷史 migrations 只 WARN，不 fail（已是既定事實）。

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

# Build NEW migration filenames (newline-separated, bash 3 friendly)
NEW_FILES=""
if [ -n "$SINCE_REF" ]; then
  NEW_FILES=$(git diff --name-only --diff-filter=AM "$SINCE_REF"...HEAD -- "$MIGRATIONS_DIR/" 2>/dev/null | grep '\.sql$' | xargs -n1 basename 2>/dev/null || true)
  COUNT=$(echo "$NEW_FILES" | grep -c '\.sql$' || echo 0)
  echo "📋 NEW/modified migrations vs $SINCE_REF: $COUNT"
  [ -n "$NEW_FILES" ] && echo "$NEW_FILES" | sed 's/^/   - /'
  echo ""
fi

# is_new() helper — checks if basename in NEW_FILES list
is_new() {
  [ -z "$SINCE_REF" ] && return 0  # no gate mode → treat all as new (errors only when no --since)
  echo "$NEW_FILES" | grep -qx "$1"
}

# Build list of parents that have CASCADE children (across ALL migrations)
declare -a CASCADE_PARENTS=()
while IFS= read -r line; do
  parent=$(echo "$line" | grep -oE 'REFERENCES[[:space:]]+[a-z_]+' | awk '{print $2}' | head -1)
  if [ -n "$parent" ]; then
    if [[ ! " ${CASCADE_PARENTS[*]:-} " =~ " ${parent} " ]]; then
      CASCADE_PARENTS+=("$parent")
    fi
  fi
done < <(grep -hE 'REFERENCES[[:space:]]+[a-z_]+.*ON[[:space:]]+DELETE[[:space:]]+CASCADE' "$MIGRATIONS_DIR"/*.sql 2>/dev/null || true)

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
          # Historical applied migration — WARN only
          echo "⚠️  HISTORICAL UNSAFE: $base"
          echo "   - DROP TABLE \`$parent\` without backup-restore"
          echo "   - Already applied to prod; cannot retroactively fix"
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
