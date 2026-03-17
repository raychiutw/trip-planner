## 1. 基礎建設

- [x] 1.1 安裝 cloudflared：winget install（改用 Quick Tunnel，不需 Named Tunnel）
- [x] 1.2 Quick Tunnel 取代 Named Tunnel：start-agent.ps1 自動擷取 URL + 更新 Pages 環境變數
- [x] 1.3 建立 `server/tunnel.yml`：placeholder（Quick Tunnel 不需要）
- [x] 1.4 產生 WEBHOOK_SECRET 隨機字串
- [x] 1.5 設定 Pages 環境變數：WEBHOOK_SECRET（TUNNEL_URL 由 start-agent.ps1 自動設定）

## 2. 本機 Server

- [x] 2.1 建立 `server/package.json`：dependencies（express, @anthropic-ai/claude-agent-sdk）
- [x] 2.2 `cd server && npm install`
- [x] 2.3 建立 `server/lib/auth.js`：X-Webhook-Secret 驗證 middleware
- [x] 2.4 建立 `server/routes/process.js`：POST /process handler + Agent SDK query + request queue
- [x] 2.5 建立 `server/index.js`：Express :3001 + /health + /process + graceful shutdown
- [ ] 2.6 本機測試：手動啟動 server + tunnel，curl 測試 /health 和 /process

## 3. Webhook 觸發

- [x] 3.1 修改 `functions/api/requests.ts`：POST 成功後 fire-and-forget 呼叫 TUNNEL_URL/process
- [ ] 3.2 部署 Pages Functions（git push）
- [ ] 3.3 端對端測試：manage 頁送出請求 → Tunnel → 本機處理 → D1 更新

## 4. 開機自啟

- [x] 4.1 建立 `scripts/start-agent.ps1`：啟動 cloudflared + node server
- [x] 4.2 建立 `scripts/register-agent.ps1`：註冊 TripPlanner-AgentServer 排程
- [x] 4.3 建立 `scripts/unregister-agent.ps1`：移除排程
- [ ] 4.4 測試：重新登入確認自動啟動

## 5. 清理

- [ ] 5.1 移除 TripPlanner-AutoRequest 輪詢排程
- [ ] 5.2 更新 CLAUDE.md：加入 agent server 架構說明
- [x] 5.3 更新 .gitignore：排除 tunnel credentials
