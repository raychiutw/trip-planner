## 1. 基礎建設

- [ ] 1.1 安裝 cloudflared：`winget install cloudflare.cloudflared`
- [ ] 1.2 建立 Named Tunnel：`cloudflared tunnel create trip-agent`，記錄 UUID
- [ ] 1.3 建立 `server/tunnel.yml`：填入 tunnel UUID 和 credentials path
- [ ] 1.4 產生 WEBHOOK_SECRET 隨機字串
- [ ] 1.5 設定 Pages 環境變數：TUNNEL_URL + WEBHOOK_SECRET

## 2. 本機 Server

- [ ] 2.1 建立 `server/package.json`：dependencies（express, @anthropic-ai/claude-agent-sdk）
- [ ] 2.2 `cd server && npm install`
- [ ] 2.3 建立 `server/lib/auth.js`：X-Webhook-Secret 驗證 middleware
- [ ] 2.4 建立 `server/routes/process.js`：POST /process handler + Agent SDK query + request queue
- [ ] 2.5 建立 `server/index.js`：Express :3001 + /health + /process + graceful shutdown + tunnel process 監控
- [ ] 2.6 本機測試：手動啟動 server + tunnel，curl 測試 /health 和 /process

## 3. Webhook 觸發

- [ ] 3.1 修改 `functions/api/requests.ts`：POST 成功後 fire-and-forget 呼叫 TUNNEL_URL/process
- [ ] 3.2 部署 Pages Functions（git push）
- [ ] 3.3 端對端測試：manage 頁送出請求 → Tunnel → 本機處理 → D1 更新

## 4. 開機自啟

- [ ] 4.1 建立 `scripts/start-agent.ps1`：啟動 cloudflared + node server
- [ ] 4.2 建立 `scripts/register-agent.ps1`：註冊 TripPlanner-AgentServer 排程
- [ ] 4.3 建立 `scripts/unregister-agent.ps1`：移除排程
- [ ] 4.4 測試：重新登入確認自動啟動

## 5. 清理

- [ ] 5.1 移除 TripPlanner-AutoRequest 輪詢排程
- [ ] 5.2 更新 CLAUDE.md：加入 agent server 架構說明
- [ ] 5.3 更新 .gitignore：排除 tunnel credentials
