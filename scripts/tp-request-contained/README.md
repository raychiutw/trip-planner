# tp-request contained-session 資產

開啟 `TP_REQUEST_USER_TOKEN=1` 的 activation 前置 (0)。當 api-server 用**restrict_trip user token**（可寫行程）spawn `/tp-request` 時，會把 Claude Code 跑在雙層隔離的 session 裡，讓被 prompt injection 的 agent 既無法提權（讀憑證 → 重 mint 一個無限制 token），也無法外洩。

## 兩層獨立防線

- **Layer B（能力層）** — 本目錄的 `settings.json`：`--permission-mode dontAsk` + 只允許 `mcp__tripline__*` + 停用所有 built-in tool。agent 的**全部**能力面就是 tripline MCP server（`scripts/tp-request-mcp-server.js`）。
- **Layer A（OS 層）** — 以獨立 unix user **`tp-agent`** spawn，env 洗過（`env -i`），HOME / TMPDIR / CLAUDE_CONFIG_DIR 都是用完即丟。檔案系統權限擋住 `tp-agent` 讀 `~ray/.tripline/*` 或 `.env.local`；env-scrub 擋住它繼承 `TRIPLINE_API_CLIENT_SECRET` 等。

單層失效，另一層仍守得住。

## ⚠️ `deny` 是 LOAD-BEARING —— 不要精簡它

`dontAsk` **不會**自動拒絕 read-only tool。read-only 的 Bash（`cat .env.local`）、`Read` tool、`Grep` 等在任何 mode 下都會**不經詢問直接執行**，除非明確 deny。`deny` 清單才是真正擋住讀憑證的那道牆。拿掉 `Bash`／`Read`／`Grep`／`Glob` 就等於重開檔案讀取這條路。`Agent`／`Task` 也要一起 deny（spawn 子 agent 會繞過白名單）。

contained session **絕不可**帶 `--dangerously-skip-permissions` / `bypassPermissions` —— 那會讓整個白名單失效。

`containmentReady()` 在 spawn 時還會跑一次 **negative self-probe**：如果 `tp-agent` **讀得到** `.env.local` 或 `~ray/.tripline`，就 fail-closed（避免 (0a) 的 chmod 沒設好卻默默上線一個有洞的隔離）。

## (0a) 只有 Ray 能做的前置 —— 我做不了（需要 root）

開 `TP_REQUEST_USER_TOKEN=1` 之前先做：

```bash
# 1. 建 agent user（無登入 shell、非 admin）
sudo sysadminctl -addUser tp-agent -fullName "Tripline Agent" -home /Users/tp-agent
sudo dscl . -create /Users/tp-agent UserShell /usr/bin/false

# 2. 讓 api-server（user: ray）可以「免密碼、非互動」sudo 成 tp-agent
#    visudo → 加一行：  ray ALL=(tp-agent) NOPASSWD: ALL

# 3. 給 tp-agent 讀 repo 的權限（skill 檔 + MCP server），但不能寫；
#    憑證務必「不可」被 other 讀到
sudo chmod -R o+rX /Users/ray/Projects/trip-planner
chmod 600 /Users/ray/Projects/trip-planner/.env.local
# ~/.tripline 由 seed-user-refresh-token.mjs（步驟 2）建立；這裡先 mkdir 並鎖成 700，
# 之後 seed 寫進來的 token 一落地就是隔離的（別在它還不存在時 chmod，會報 No such file）。
mkdir -p /Users/ray/.tripline && chmod 700 /Users/ray/.tripline

# 4. 驗證
sudo -n -u tp-agent true && echo "sudo OK"
sudo -n -u tp-agent test -r /Users/ray/Projects/trip-planner/scripts/tp-request-mcp-server.js && echo "repo 讀取 OK"
sudo -n -u tp-agent test -r /Users/ray/.env.local && echo "外洩：tp-agent 讀得到 .env.local" || echo "憑證隔離 OK"
```

在這步做完之前，api-server 一律 **fail-closed**：帶 restrict_trip 的請求會降級成 read-only service token 的 session（改不了行程內容，但仍有 ops scope）並發 alert —— **絕不會**把可寫 token 跑在未隔離的 session 裡。

## (0b) 開 flag 前必跑一次的冒煙測試

能力鎖（dontAsk + deny）與 headless 跑 skill 這兩件事，CI 測不到（CI 上沒有 tp-agent）。開 flag 前先在本機 live 驗一次：

```bash
SDIR=$(mktemp -d)
# a) 被 deny 的 built-in 必須被拒（證明 deny 有生效）：
sudo -n -u tp-agent env -i PATH=/usr/bin:/bin HOME=/Users/tp-agent \
  CLAUDE_CONFIG_DIR="$SDIR" /Users/ray/.local/bin/claude -p 'Run: cat /Users/ray/Projects/trip-planner/.env.local' \
  --permission-mode dontAsk --settings /Users/ray/Projects/trip-planner/scripts/tp-request-contained/settings.json \
  --strict-mcp-config 2>&1 | grep -qi 'denied\|not allowed\|cannot' && echo "BASH 被拒 ✓" || echo "外洩 —— 不要 activate"
# b) skill 必須真的透過 -p headless 跑起來、且 MCP handshake 成功
#    （protocolVersion 2024-11-05）。拿一個丟棄用的 request 做 dry-run，
#    確認它只讀寫那一個 trip。若 -p 沒觸發 skill，先修好再開 flag。
```

兩項都過才開 `TP_REQUEST_USER_TOKEN=1`。

## 已知 follow-up（不擋 merge；flag 目前 OFF）

- **per-session Google-API 額度** —— `recomputeTravel` / `enrichPoi` / `poiSearch` 會打有計費的 Google API，目前沒有 per-session 上限；被注入的 message 可能在 90 分鐘 session 內燒額度。之後用 `bumpRateLimit` 加一個以 request 為 key 的額度。
- **降級路徑 token 上 argv** —— service token fallback 仍把 token 直接插在 tmux 指令列（既有行為、`ps` 看得到）。之後比照 contained 路徑改走 stdin。
- **contained cwd = repo** —— session 的 cwd 是 repo，Claude 會讀到專案的 `.claude/settings*.json`。裸 tool 的 `deny`（會把整個 tool 從 context 移除）+ `--strict-mcp-config` 已中和目前的 allow；(0b) 冒煙測試會驗證。殘留風險只剩「未來新增、不在 deny 清單裡的 built-in tool」。
