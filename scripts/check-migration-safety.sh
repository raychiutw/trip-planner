#!/usr/bin/env bash
# scripts/check-migration-safety.sh — pre-deploy gate against D1 cascade wipeout
#
# 2026-05-04 incident: migration 0047 用 PRAGMA foreign_keys = OFF + DROP TABLE trips
# 預期會抑制 ON DELETE CASCADE，但 D1 不 honor cross-statement PRAGMA → CASCADE 觸發
# → 全 prod trip_days/entries/pois/destinations/docs 砍光。
#
# 掃 migrations/ 找「DROP TABLE <parent>」而 <parent> 有 REFERENCES ... ON DELETE
# CASCADE 的 children，且該 migration 沒有真的做 backup-restore。
#
# 這是 grep，不是 SQL parser —— defence in depth，不是證明。PASS 只代表「這幾條 grep
# 沒抓到東西」。已知擋不住的至少有：DELETE FROM <parent>（CASCADE 一樣砍光 children）、
# 動態 SQL、以及任何 sql_statements() 的正規化沒涵蓋到的合法寫法。
#
# Usage:
#   bash scripts/check-migration-safety.sh                    # check ALL (informational)
#   bash scripts/check-migration-safety.sh --since=<ref>      # gate mode (block on NEW)
#
# Exit codes:
#   0 = PASS（無不安全的 NEW migration）
#   1 = 不安全 NEW migration；CI 用此 exit code block deploy
#   2 = gate 本身跑不起來（--since ref 解不開 / 未知參數）—— 不是「安全」，是「沒檢查」
#
# 行為由 tests/unit/check-migration-safety.test.ts 鎖住。

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
  CHANGED=$(git diff --name-only --diff-filter=AM --no-renames "$SINCE_REF"...HEAD -- "$MIGRATIONS_DIR/")
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

# 把 .sql 正規化成「一行一個 SQL 敘述」的串流。CASCADE 偵測與 DROP 偵測都走這裡 ——
# 兩邊形狀不一致正是 gate 漏掉一堆合法寫法的原因。每一項都對應一個實測過的繞過：
#   剝 /* */ 與 -- 註解  一句「no _backup_trips needed」的註解就能讓 DROP TABLE 過關
#   拿掉 " ` [ ]        DROP TABLE "trips" / [trips] 是合法 SQL，裸識別字 grep 不認
#   轉小寫              drop table trips 一樣合法
#   壓換行後依 ; 切      FOREIGN KEY / REFERENCES / ON DELETE CASCADE 分寫三行是合法的；
#                       DROP TABLE trips 後面換行才打 ; 也是
sql_statements() {
  perl -0pe 's{/\*.*?\*/}{ }gs; s{--[^\n]*}{}g' "$@" \
    | tr -d '"`[]' \
    | tr 'A-Z' 'a-z' \
    | tr '\n' ' ' \
    | tr ';' '\n'
}

# 哪些 parent 有 CASCADE children（掃全部 migration）。
# 取敘述內每一個 references（非 head -1）：寧可多擋，不可漏一個而砍光 prod。
# 字元類含數字：trip_docs_v2 曾被 [a-z_]+ 截成 trip_docs_v —— gate 保護著一張不存在的表，
# 而真的有 CASCADE child 的 trip_docs_v2 全無防護（migrations/0019_normalize_docs.sql:16）。
declare -a CASCADE_PARENTS=()
while IFS= read -r parent; do
  if [ -n "$parent" ]; then
    if [[ ! " ${CASCADE_PARENTS[*]:-} " =~ " ${parent} " ]]; then
      CASCADE_PARENTS+=("$parent")
    fi
  fi
done < <(
  sql_statements "$MIGRATIONS_DIR"/*.sql \
    | grep -E 'on[[:space:]]+delete[[:space:]]+cascade' \
    | grep -oE 'references[[:space:]]+[a-z0-9_.]+' \
    | awk '{print $2}' \
    | sed 's/^main\.//' \
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
UNSAFE_PRE_EXISTING=0

# Scan each migration for DROP TABLE on cascade-parent
for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  base=$(basename "$migration")
  stmts=$(sql_statements "$migration")

  # 真的做了 backup 才算 backup。舊寫法 grep 整個檔案找「_backup_」字樣，所以一句
  # 「-- no _backup_trips needed」的註解就替整檔背書；而 _backup_trip_ 那條分支與
  # parent 無關，提到 _backup_trip_days 的註解能同時替 DROP TABLE pois 背書。
  has_backup=0
  if echo "$stmts" | grep -qE "create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?_backup_[a-z0-9_]+[[:space:]]+as[[:space:]]+select"; then
    has_backup=1
  fi

  for parent in "${CASCADE_PARENTS[@]}"; do
    # 敘述已依 ; 切開，parent 後面只會是空白或行尾。尾錨不可省：少了它
    # DROP TABLE trips_new（0047 的 swap idiom 用得到）會被誤判成 DROP TABLE trips。
    if echo "$stmts" | grep -qE "drop[[:space:]]+table[[:space:]]+(if[[:space:]]+exists[[:space:]]+)?(main\.)?${parent}([[:space:]]|$)"; then
      if [ "$has_backup" -eq 0 ]; then
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
          UNSAFE_PRE_EXISTING=$((UNSAFE_PRE_EXISTING + 1))
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
echo "Summary: NEW unsafe=$UNSAFE_NEW, pre-existing unsafe=$UNSAFE_PRE_EXISTING"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ PASS — no NEW migration risks D1 CASCADE wipe."
else
  echo "❌ FAIL — at least one NEW migration risks D1 CASCADE wipe. Block deploy."
fi

exit $EXIT_CODE
