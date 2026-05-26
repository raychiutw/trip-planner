# funnel-guard

Tailscale funnel `:443` drift 自動偵測 + 復原 + Telegram alert（launchd job，每 120s）。

## 為何

macOS update / GUI app / 第三方 brew 反覆把 funnel `:443` 改成 `serve` (tailnet only) → CF Worker public `fetch(TRIPLINE_API_URL + '/trigger')` 全 530。已第 3 次（v2.33.111 紀錄）。

走「auto-heal + alert」比試圖封鎖 Tailscale CLI 實際 — `tailscaled` 的 localapi socket 設計上開放給任何 local process。

## 行為

每 120 秒（launchd `StartInterval`）：

1. `tailscale serve status --json` 偵測：
   - `AllowFunnel[*:443] == true`（區別 funnel vs serve）
   - `Web[*:443].Handlers["/"].Proxy == "http://127.0.0.1:8080"`
2. 兩個條件不齊 → 跑 `tailscale serve reset` + `tailscale funnel --bg --https=443 http://127.0.0.1:8080`
3. 重設後再驗一次：
   - 成功 → Telegram 通知「已自動 reset」
   - 失敗 → Telegram 通知「heal 後仍 unhealthy，請手動檢查」

## 安裝

```bash
zsh scripts/funnel-guard/install.sh
```

Idempotent — 重跑會先 bootout 再 bootstrap。

前置：
- `/opt/homebrew/bin/tailscale` 已裝
- `jq` 已裝（macOS 通常內建 `/usr/bin/jq`；缺則 `brew install jq`）
- `.env.local` 含 `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`（對齊 `scripts/lib/send-telegram.sh`）

## 驗證

```bash
# 確認 job 已 load
launchctl print gui/$(id -u)/com.tripline.funnel-guard | head -20

# 即時看 log
tail -f scripts/logs/funnel-guard/stdout.log

# 手動觸發一次跑（不等 120s）
launchctl kickstart -k gui/$(id -u)/com.tripline.funnel-guard
```

## 測試 drift 復原

```bash
# 故意製造 drift：關掉 funnel + 改用 serve（tailnet only，外網打不到）
tailscale funnel --https=443 off
tailscale serve --bg http://127.0.0.1:8080

# 驗證 drift 狀態 — AllowFunnel 應為空
tailscale serve status --json | jq '.AllowFunnel'

# 等 120s 內 guard 應 detect + heal + Telegram alert（或手動 kickstart）
launchctl kickstart -k gui/$(id -u)/com.tripline.funnel-guard
sleep 6
tailscale serve status --json | jq '.AllowFunnel'
# 預期：{ "ray-chiudemac-mini.tail2750c0.ts.net:443": true }
```

## 緊急停用（incident response）

安全事件時若需要把 `:443` 拉下線（`tailscale funnel --https=443 off` 或改 serve-only），先建 kill-switch 防止 guard 把它推回來：

```bash
touch /Users/ray/Projects/trip-planner/scripts/funnel-guard/.disabled
# 之後 guard 每次 tick 都 skip
```

恢復：

```bash
rm /Users/ray/Projects/trip-planner/scripts/funnel-guard/.disabled
```

> `.disabled` 在 `.gitignore`，不會被誤 commit。

## Alert 頻率設計

state-transition + 1hr throttle：

| 情境 | 是否發 alert |
|---|---|
| healthy → healthy（連續正常） | 否 |
| healthy → drift → heal 成功 | 是（recovery 訊號重要） |
| drift → heal 失敗 → drift（連續壞） | 第一次發；同 state 持續 1hr 才再發 |
| unhealthy → healthy（從壞變好） | 是（永遠發 recovery） |
| state change（healed → heal_failed 等） | 是 |

state cache 在 `/tmp/funnel-guard.state`（reboot 後重置 → 第一次 healthy 也不發，避免開機 noise）。

## 解除安裝

```bash
launchctl bootout gui/$(id -u)/com.tripline.funnel-guard
rm ~/Library/LaunchAgents/com.tripline.funnel-guard.plist
```

## 偵錯

| 症狀 | 檢查 |
|---|---|
| Telegram 沒收到 | `.env.local` 內 `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` 是否設了，`bash scripts/lib/send-telegram.sh "test"` 手動測試 |
| log 完全沒寫 | `scripts/logs/funnel-guard/` 目錄是否存在、權限是否 user 可寫 |
| `is_funnel_healthy` 永遠 false | `tailscale serve status --json` 出來的 hostname `:443` key 結尾是否符合 `endswith(":443")`；jq 是否在 PATH |
| `heal_funnel` exit 非 0 | tailscaled 是否 running（`tailscale status`）；user 是否 logged in |
| 重複 alert 太多 | 看 log heal 次數 — 若 1 小時 > 10 次表示有外部 process 一直改 serve；查 `~/Library/Logs/` 找元兇 |
| log 過大 | `scripts/logs/funnel-guard/stdout.log` 不自動 rotate，~720 行/天 × ~50 bytes ≈ 13MB/年；過大可手動 `: > scripts/logs/funnel-guard/stdout.log` 截斷 |

## 設計取捨

- **Polling 120s 而非 WatchPaths**：tailscale config 內部結構不公開，version drift 風險高。120s + 8s CF timeout + 30min cron 兜底，足夠覆蓋。
- **不開 sudo NOPASSWD**：`tailscale funnel` user perm 透過 tailscaled socket 即可，不需 root。少一個攻擊面。
- **Telegram via send-telegram.sh 而非 api-server endpoint**：guard 不依賴 api-server 健康（api-server crash 時 guard 仍能 alert）。
- **每次 heal 都通知**：drift 頻率 = 外部 root cause 訊號（brew autoupdate / GUI app / macOS update）。低頻時 alert 量可接受。
