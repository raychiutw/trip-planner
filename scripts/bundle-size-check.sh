#!/usr/bin/env bash
# bundle-size-check.sh — 驗 dist/assets/*.js gzipped size 全部 ≤ THRESHOLD_KB
# B-P6 task 11.3 / 6.4 ship gate
#
# Usage: bash scripts/bundle-size-check.sh
# Env:   THRESHOLD_KB (default 300)
#
# Exit codes:
#   0 — all chunks within threshold
#   1 — at least one chunk exceeds threshold (報告超出 chunks）
#   2 — dist/assets 不存在（需先 npm run build）

set -euo pipefail

THRESHOLD_KB="${THRESHOLD_KB:-300}"
THRESHOLD_BYTES=$((THRESHOLD_KB * 1024))
ASSETS_DIR="dist/assets"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "ERROR: $ASSETS_DIR 不存在 — 請先 npm run build" >&2
  exit 2
fi

# shellcheck disable=SC2207
JS_FILES=($(find "$ASSETS_DIR" -name '*.js' -type f))

if [ ${#JS_FILES[@]} -eq 0 ]; then
  echo "ERROR: $ASSETS_DIR 內找不到任何 .js — build 可能 fail" >&2
  exit 2
fi

OVER=()
TOTAL_OK=0
TOTAL_OVER=0

for f in "${JS_FILES[@]}"; do
  GZ=$(gzip -c "$f" | wc -c | tr -d ' ')
  if [ "$GZ" -gt "$THRESHOLD_BYTES" ]; then
    OVER+=("$(basename "$f"): $((GZ / 1024))KB gzipped")
    TOTAL_OVER=$((TOTAL_OVER + 1))
  else
    TOTAL_OK=$((TOTAL_OK + 1))
  fi
done

echo "Bundle size check (threshold: ${THRESHOLD_KB}KB gzipped)"
echo "  Within threshold: ${TOTAL_OK} chunks"

if [ ${#OVER[@]} -gt 0 ]; then
  echo "  Over threshold:   ${TOTAL_OVER} chunks"
  printf '    - %s\n' "${OVER[@]}"
  echo ""
  echo "FAIL: bundle size gate"
  exit 1
fi

echo "  Over threshold:   0 chunks"
echo ""
echo "OK: bundle size gate passed"
