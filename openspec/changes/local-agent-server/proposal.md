## Why

旅伴透過 manage 頁送出行程修改請求後，目前依賴 Windows Task Scheduler 每分鐘輪詢 D1，最長等待 1 分鐘才開始處理。改為推送模式：旅伴送出請求 → Pages Function 透過 Cloudflare Named Tunnel 即時呼叫本機 Agent Server → Claude Agent SDK 立刻處理 → 5-30 秒內回覆。

## What Changes

- 新增 `server/` 目錄：本機 Express server + Claude Agent SDK，監聽 :3001
- 新增 Cloudflare Named Tunnel 設定：固定 URL 暴露本機 API
- 修改 `functions/api/requests.ts`：POST 成功後 fire-and-forget 呼叫 Tunnel
- 新增 `scripts/start-agent.ps1`：一鍵啟動 server + tunnel
- 新增 `scripts/register-agent.ps1`：註冊 Windows Task Scheduler 開機自啟
- 新增 Pages 環境變數：`TUNNEL_URL`、`WEBHOOK_SECRET`
- 可移除 Windows Task Scheduler 的 `TripPlanner-AutoRequest` 輪詢排程（由推送取代）

## Capabilities

### New Capabilities
- `agent-server`: 本機 Express server，接收 webhook，用 Claude Agent SDK 處理旅伴請求
- `tunnel-integration`: Cloudflare Named Tunnel 設定、Pages Function 轉發 webhook、shared secret 認證
- `agent-autostart`: Windows Task Scheduler 開機自啟 server + tunnel

### Modified Capabilities
（無既有 spec 需修改）

## Impact

**新增的檔案：**
- `server/package.json`、`server/index.js`、`server/routes/process.js`、`server/lib/auth.js`、`server/tunnel.yml`
- `scripts/start-agent.ps1`、`scripts/register-agent.ps1`、`scripts/unregister-agent.ps1`

**修改的檔案：**
- `functions/api/requests.ts` — POST handler 加 webhook 呼叫
- `.gitignore` — 排除 tunnel credentials
- `CLAUDE.md` — 加入 agent server 架構說明

**外部依賴：**
- `@anthropic-ai/claude-agent-sdk`（npm，server/ 獨立 package.json）
- `express`（npm）
- `cloudflared`（CLI，需預先安裝：`winget install cloudflare.cloudflared`）

**無 checklist/backup/suggestions 連動影響**
