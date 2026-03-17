## Context

trip-planner 已遷移至 D1 API 架構（trip-data-to-d1），旅伴請求透過 manage 頁 POST 到 D1。目前 tp-request 由 Windows Task Scheduler 每分鐘輪詢。本變更新增本機 agent server，以推送方式即時處理請求。

## Goals / Non-Goals

**Goals:**
- 旅伴送出請求後 5-30 秒內開始處理（取代最長 1 分鐘的輪詢延遲）
- 使用 Claude Agent SDK + OAuth 認證（不需 API key）
- Cloudflare Named Tunnel 提供固定 URL（免費，不需自有 domain）
- Windows 開機自動啟動 server + tunnel
- Webhook shared secret 防止未授權呼叫

**Non-Goals:**
- 不做高可用（電腦關機時 fallback 回輪詢，或請求留在 DB 等開機後處理）
- 不做 queue（一次一個請求，序列處理）
- 不改前端 manage 頁（使用者不感知後端變化）

## Decisions

### 1. 本機 Server 架構

```
server/
├── package.json          ← express + @anthropic-ai/claude-agent-sdk
├── index.js              ← Express :3001, health check, graceful shutdown
├── routes/
│   └── process.js        ← POST /process { requestId }
├── lib/
│   └── auth.js           ← X-Webhook-Secret header 驗證
└── tunnel.yml            ← cloudflared named tunnel 設定
```

**Express :3001** — 輕量 HTTP server，只有兩個 route：
- `GET /health` — tunnel 健康檢查
- `POST /process` — 接收 webhook，觸發 Claude 處理

### 2. Claude Agent SDK 呼叫方式

```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: `處理旅伴請求 #${requestId}：...`,
  options: {
    cwd: PROJECT_ROOT,
    allowedTools: ["Bash", "Read", "Grep", "Glob"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 30,
    model: "claude-sonnet-4-6",
    settingSources: ["project"],
  },
})) {
  if ("result" in message) return message.result;
}
```

- **OAuth 認證**：共用 `claude login` 的 token，不需 API key
- **settingSources: ["project"]**：讀 CLAUDE.md，agent 知道專案規範
- **Bash tool**：agent 用 curl 呼叫 D1 API 讀寫行程資料
- **bypassPermissions**：server 環境自動執行，不需人工確認
- **model: sonnet**：成本效率，處理旅伴請求不需 opus

### 3. Cloudflare Named Tunnel

```bash
# 一次性設定
cloudflared tunnel create trip-agent
# → Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# → Credentials: ~/.cloudflared/xxxxxxxx.json

# tunnel.yml
tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
credentials-file: C:\Users\RayChiu\.cloudflared\xxxxxxxx.json
ingress:
  - service: http://localhost:3001
```

- **固定 URL**：`xxxxxxxx.cfargotunnel.com`（不需自有 domain）
- **Pages 環境變數**：`TUNNEL_URL = https://xxxxxxxx.cfargotunnel.com`
- **免費**：Named Tunnel 免費方案無限制

### 4. Pages Function Webhook 觸發

`functions/api/requests.ts` 的 POST handler 修改：

```typescript
// 寫入 D1 後，fire-and-forget 呼叫 Tunnel
const result = await env.DB.prepare('INSERT ...').bind(...).first();

if (env.TUNNEL_URL) {
  fetch(env.TUNNEL_URL + '/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': env.WEBHOOK_SECRET,
    },
    body: JSON.stringify({ requestId: result.id }),
  }).catch(() => {}); // 失敗不影響 request 建立
}

return json(result, 201);
```

- **fire-and-forget**：不等 agent 處理完，立刻回覆 201 給旅伴
- **失敗容錯**：Tunnel 不通時靜默失敗，請求留在 DB 等手動處理

### 5. 安全

- **Webhook Secret**：Pages Function 和本機 server 共享一個 secret
- **Pages 環境變數**：`WEBHOOK_SECRET` 加密儲存
- **本機 server**：驗證 `X-Webhook-Secret` header，不符合 → 403
- **Tunnel 加密**：cloudflared 自動 TLS

### 6. 開機自啟

```powershell
# scripts/start-agent.ps1
# 同時啟動 server 和 tunnel

Start-Process -NoNewWindow cloudflared "tunnel run trip-agent"
node server/index.js

# register-agent.ps1
# 註冊 Windows Task Scheduler，AtLogOn 觸發
```

### 7. 斷線恢復

server/index.js 內建：
- cloudflared process 監控：每 30 秒檢查，斷線自動重啟
- Express 錯誤處理：500 不會 crash server
- Claude SDK session：每次 query() 獨立，不需維護長 session

## Risks / Trade-offs

- **[電腦關機]** Tunnel 不通，webhook 靜默失敗 → 請求留在 DB，開機後可手動跑 /tp-request 或等下一個 webhook
- **[Claude OAuth 過期]** Agent SDK token 定期需重新認證 → claude login 的 refresh token 通常長效
- **[並發請求]** 多個旅伴同時送出 → 序列處理（Agent SDK 一次一個 query），後面的排隊
- **[成本]** 每次處理消耗 Claude sonnet tokens → 一般請求約 $0.01-0.05
