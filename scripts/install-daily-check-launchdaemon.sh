#!/bin/zsh
# install-daily-check-launchdaemon.sh — daily-check 從 LaunchAgent 遷 LaunchDaemon
#
# 背景：2026-05-07~05-10 連 4 天 LaunchAgent 沒 fire（Mac 沒睡、user logged in、
# 沒任何 sleep event）。最可能原因是 macOS XPC activity throttling 對 user-tier
# LaunchAgent 的節流。LaunchDaemon 跑在 system domain，不受 user session/XPC
# throttle 影響。
#
# 此腳本：(1) bootout 既有 LaunchAgent (2) 安裝 LaunchDaemon 到 /Library/
# LaunchDaemons (3) bootstrap (4) 印狀態驗證。
#
# 需 sudo。可重複跑（idempotent）。

set -eo pipefail

PROJECT_DIR="/Users/ray/Projects/trip-planner"
LABEL="com.tripline.daily-check"
PLIST_SRC="$PROJECT_DIR/scripts/$LABEL.plist"
PLIST_DST="/Library/LaunchDaemons/$LABEL.plist"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ ! -f "$PLIST_SRC" ]; then
  echo "✗ source plist 不存在: $PLIST_SRC" >&2
  exit 1
fi

echo "=== Phase 1: bootout 既有 LaunchAgent (if any) ==="
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" && echo "✓ LaunchAgent booted out"
else
  echo "・ LaunchAgent 未載入，跳過"
fi

if [ -f "$LAUNCH_AGENT" ]; then
  mv "$LAUNCH_AGENT" "$LAUNCH_AGENT.migrated-$(date +%Y%m%d)" \
    && echo "✓ 舊 LaunchAgent plist 已備份為 $LAUNCH_AGENT.migrated-*"
fi

echo ""
echo "=== Phase 2: bootout 既有 LaunchDaemon (if any) ==="
if sudo launchctl print "system/$LABEL" >/dev/null 2>&1; then
  sudo launchctl bootout "system/$LABEL" && echo "✓ 舊 LaunchDaemon booted out"
else
  echo "・ LaunchDaemon 未載入，跳過"
fi

echo ""
echo "=== Phase 3: 安裝 plist 到 $PLIST_DST ==="
sudo cp "$PLIST_SRC" "$PLIST_DST"
sudo chown root:wheel "$PLIST_DST"
sudo chmod 644 "$PLIST_DST"
echo "✓ plist 已就位（root:wheel 644）"

echo ""
echo "=== Phase 4: bootstrap LaunchDaemon ==="
sudo launchctl bootstrap system "$PLIST_DST"
echo "✓ bootstrap OK"

echo ""
echo "=== Phase 5: 驗證 ==="
sudo launchctl print "system/$LABEL" | head -20
echo ""
echo "下次 fire 時間（macOS 顯示）："
sudo /usr/bin/log show --predicate 'eventMessage CONTAINS "com.tripline.daily-check" AND eventMessage CONTAINS "Rescheduling"' --info --last 1m 2>/dev/null | tail -3 || true

echo ""
echo "=== 完成 ==="
echo "・ 手動觸發測試：sudo launchctl kickstart -k system/$LABEL"
echo "・ 觀察 log:    tail -f $PROJECT_DIR/.context/daily-check-stderr.log"
echo "・ 觀察當天 log: ls -la $PROJECT_DIR/scripts/logs/daily-check/\$(date +%Y-%m-%d)*"
echo ""
echo "=== ⚠ 驗證重點：Claude CLI keychain access ==="
echo "LaunchDaemon 跑在 system Mach session，不在 user GUI session 內。"
echo "Claude CLI OAuth token 在 login keychain — daemon 可能讀不到。"
echo "Phase 2 (claude /tp-daily-check) 若 auth fail："
echo ""
echo "  Rollback 回 LaunchAgent："
LATEST_BACKUP=$(ls -t "$LAUNCH_AGENT.migrated-"* 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  echo "    sudo launchctl bootout system/$LABEL"
  echo "    sudo rm $PLIST_DST"
  echo "    mv $LATEST_BACKUP $LAUNCH_AGENT"
  echo "    launchctl bootstrap gui/\$(id -u) $LAUNCH_AGENT"
else
  echo "    （備份檔不存在 — 從 PR #514 commit 取回原 LaunchAgent plist 重裝）"
fi
