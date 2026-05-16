---
name: tp-poi-enrich-monthly
description: 每月 1 號跑 POI batch enrichment，補新 POI 的 OSM rating + tags。由 Cowork daily task 觸發，skill 內部檢查日期是否 1 號。
user-invocable: true
---

每月一次 POI batch enrichment — 跑 `scripts/poi-enrich-batch.ts --limit=200` 補新 POI 的 OSM rating + tags，發 Telegram 摘要。

## 排程

**Cowork Scheduled task**（Claude Desktop 內建）：
- Name: Tripline POI Enrich Monthly
- Prompt: `/tp-poi-enrich-monthly`
- Frequency: Daily（每天 fire，skill 內檢查是否 1 號）
- Working folder: `/Users/ray/Projects/trip-planner`

**為什麼 daily fire 而非 monthly？** Cowork 只支援 hourly / daily / weekly / weekdays / manual — 沒 monthly。Daily fire + skill 內檢查 `date +%d == 01` 是 cleanest workaround，浪費 30 次 noop fire 換 monthly 一次 batch（無 LLM token 成本，只 1 ms script check）。

v2.30.x Cowork migration 前的 launchd `poi-enrich-scheduler.sh` + `~/.local/bin/tripline-poi-enrich-monthly.sh` 已移除。

## 執行步驟

### Phase 0: 檢查是否 1 號

```bash
cd /Users/ray/Projects/trip-planner

if [ "$(date +%d)" != "01" ]; then
  echo "Today $(date +%Y-%m-%d) is not the 1st of month — skipping POI enrich batch."
  exit 0
fi
```

### Phase 1: 載 env + 跑 batch

```bash
eval "$(node scripts/lib/load-env.mjs .env.local)"

LOG_DIR="scripts/logs/poi-enrich"
mkdir -p "$LOG_DIR"
RUN_DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/$RUN_DATE.log"
BATCH_OUTPUT="$LOG_DIR/$RUN_DATE-batch-output.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ==== POI enrich monthly batch 開始 (limit=200) ====" >> "$LOG_FILE"

# Run batch — capture exit code
set +e
/opt/homebrew/bin/bun scripts/poi-enrich-batch.ts --limit=200 > "$BATCH_OUTPUT" 2>&1
EXIT_CODE=$?
set -e
```

### Phase 2: 解析 stats + 組 Telegram 摘要

```bash
UPDATED=$(grep -E "^\s*updated:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
CACHED=$(grep -E "^\s*cached:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
NO_DATA=$(grep -E "^\s*no_data:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
ERROR=$(grep -E "^\s*error:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
TOTAL=$(grep -E "^\s*total:" "$BATCH_OUTPUT" | tail -1 | awk '{print $2}' || echo 0)
ERR_BREAKDOWN=$(grep "ERROR:" "$BATCH_OUTPUT" 2>/dev/null \
  | awk -F'ERROR: ' '{print $2}' | sort | uniq -c | sort -rn | head -3 \
  | awk '{printf "%s×%d ", $2$3$4, $1}' || echo "")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Batch 結束 (exit=$EXIT_CODE) — total=$TOTAL updated=$UPDATED cached=$CACHED no_data=$NO_DATA error=$ERROR" >> "$LOG_FILE"

if [ "$EXIT_CODE" != "0" ] && [ "$TOTAL" = "0" ]; then
  # batch 完全 crash — 緊急通知
  TG_MSG="❌ POI enrich monthly FAILED ($RUN_DATE)
Exit code: $EXIT_CODE
Log: $LOG_FILE
Output (last 10 lines):
$(tail -10 "$BATCH_OUTPUT")"
else
  # 正常結束（部分 error 也是 OK）
  TG_MSG="📍 POI enrich monthly 完成 ($RUN_DATE)
✓ updated: $UPDATED
○ cached:  $CACHED
— no_data: $NO_DATA
✗ error:   $ERROR
─────────
total:     $TOTAL"
  if [ -n "$ERR_BREAKDOWN" ]; then
    TG_MSG="$TG_MSG

Errors: $ERR_BREAKDOWN"
  fi
fi
```

### Phase 3: 發 Telegram

```bash
bash scripts/lib/send-telegram.sh "$TG_MSG"
```

### Phase 4: Self-destruct（tmux 觸發 only — v2.31.3+）

skill **任何 termination path 之最後一步必跑**（含 day-1 guard early exit、Phase 1 dry-run 完成、Phase 2 batch 完成、中途 fatal error abort）：

```bash
# scripts/tripline-api-server.ts 內建 cron 透過 ephemeral tmux session 觸發本 skill 時
# 會 inject TRIPLINE_TMUX_SESSION + TMUX_BIN env var。執行完砍 session 避免 orphan。
# 手動 invoke（無 env var）→ skip。
if [ -n "$TRIPLINE_TMUX_SESSION" ]; then
  "${TMUX_BIN:-tmux}" kill-session -t "$TRIPLINE_TMUX_SESSION" || \
    echo "[tp-poi-enrich-monthly] WARNING: kill-session failed for $TRIPLINE_TMUX_SESSION" >&2
fi
exit "$EXIT_CODE"
```

> ⚠️ 在 Telegram 通知與 batch script 結束後執行。中途 kill 會打斷 in-flight Place Details API call。

## 環境需求

- v2.31.3 起由 `scripts/tripline-api-server.ts` 內建 cron 在每日 08:00 透過 ephemeral tmux session 觸發；skill 內 day-1 guard 自行 exit（非 1 號的 99% 場景）
- `.env.local` 內：`TELEGRAM_BOT_HOME_TOKEN`（或 `TELEGRAM_BOT_TOKEN`）/ `TELEGRAM_CHAT_ID` / `CLOUDFLARE_API_TOKEN` / `D1_DATABASE_ID` / `CF_ACCOUNT_ID`
- `bun` 在 `/opt/homebrew/bin/bun`（mac homebrew default path）
- `scripts/poi-enrich-batch.ts` 仍是 batch 主體（未變）
