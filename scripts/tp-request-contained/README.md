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

**額外一層（實測發現）**：contained session 用 disposable `CLAUDE_CONFIG_DIR`，所以 repo 的 `.claude/settings.local.json`（有多條 `Bash(...)` allow）會因 **workspace untrusted** 被 Claude Code **整批忽略**（`Ignoring N permissions.allow entries ... this workspace has not been trusted`）。等於連「cwd=repo 吃到專案 allow」那條殘留路徑也堵掉了 —— 別去互動式信任這個 workspace。

**認證**：contained 是非登入 user、沒 login keychain，訂閱 `/login` 存不了 token。改用 `claude setup-token` 產的一年期 **`CLAUDE_CODE_OAUTH_TOKEN`**（precedence 高於 `/login`），由 api-server 從 `.env.local` 讀出、寫進 0600 檔、經 sh wrapper 注入 contained claude 的 env（不上 argv）。見 (0a) 步驟 4。

## (0a) 只有 Ray 能做的前置 —— 我做不了（需要 root）

開 `TP_REQUEST_USER_TOKEN=1` 之前先做：

```bash
# 1. 建 agent user（無登入 shell、非 admin）+ 家目錄
sudo sysadminctl -addUser tp-agent -fullName "Tripline Agent" -home /Users/tp-agent
sudo dscl . -create /Users/tp-agent UserShell /usr/bin/false
# ⚠️ sysadminctl 不會真的建家目錄 → 手動建（claude 要寫 config，沒有它會 No such file）
sudo mkdir -p /Users/tp-agent && sudo chown tp-agent:staff /Users/tp-agent && sudo chmod 700 /Users/tp-agent

# 2. 讓 api-server（user: ray）免密碼、非互動 sudo 成 tp-agent
#    ⚠️ 放 /etc/sudoers.d/ —— visudo 加在主檔可能被後面的 %admin 規則蓋掉、NOPASSWD 失效
echo 'ray ALL=(tp-agent) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/tp-agent >/dev/null
sudo chmod 440 /etc/sudoers.d/tp-agent && sudo visudo -cf /etc/sudoers.d/tp-agent   # 驗語法

# 3. tp-agent 可讀 repo（skill + MCP server）但不可寫；憑證不可被 other 讀
sudo chmod -R o+rX /Users/ray/Projects/trip-planner
chmod 600 /Users/ray/Projects/trip-planner/.env.local
# ~/.tripline 由 seed（activation 步驟 2）建立；先 mkdir 鎖 700，token 一落地即隔離
mkdir -p /Users/ray/.tripline && chmod 700 /Users/ray/.tripline

# 4. claude 認證（訂閱、不碰 Keychain —— tp-agent 是非登入 user 沒 login keychain）
#    以「你自己」跑 setup-token（你的 keychain 正常）→ 產一年期 OAuth token（會印出來）
claude setup-token
#    把那串貼進 .env.local（tp-agent 讀不到；api-server 讀後注入 contained session）：
#      CLAUDE_CODE_OAUTH_TOKEN=<貼在這>
#    到期前（約一年）重跑 setup-token 換新

# 5. 驗證（先確認 sudo 通，test 的 exit code 才反映「真的讀不讀得到」）
sudo -n -u tp-agent true && echo "① sudo OK"
sudo -n -u tp-agent test -r /Users/ray/Projects/trip-planner/scripts/tp-request-mcp-server.js && echo "② repo 讀取 OK"
sudo -n -u tp-agent test -r /Users/ray/Projects/trip-planner/.env.local && echo "③ ⚠️外洩" || echo "③ .env.local 隔離 OK"
sudo -n -u tp-agent test -r /Users/ray/.tripline && echo "④ ⚠️外洩" || echo "④ ~/.tripline 隔離 OK"
grep -q '^CLAUDE_CODE_OAUTH_TOKEN=' /Users/ray/Projects/trip-planner/.env.local && echo "⑤ OAuth token OK" || echo "⑤ ⚠️缺 OAuth token"
```

在這步做完之前，api-server 一律 **fail-closed**：帶 restrict_trip 的請求會降級成 read-only service token 的 session（改不了行程內容，但仍有 ops scope）並發 alert —— **絕不會**把可寫 token 跑在未隔離的 session 裡。

## (0b) 開 flag 前的 live 驗證（我來跑，非 `-p`）

能力鎖（dontAsk + deny）與 REPL 跑 skill + MCP handshake，CI 測不到（沒有 tp-agent）。(0a) ⑤ 全過後告訴我，我用**真實 contained 機制**（互動 tmux REPL，跟 prod 一樣，**不用 `-p`**）跑一次 dry-run，看 `scripts/logs/tp-request/<session>.log` 確認：

- claude 用 `CLAUDE_CODE_OAUTH_TOKEN` 認證成功、REPL 起得來；
- 叫它讀憑證（`cat .env.local` 之類）→ **被 deny 擋掉**、拿不到內容；
- 只用得到 `mcp__tripline__*` 工具，且只碰那一個 restrict trip。

三項都過，才開 `TP_REQUEST_USER_TOKEN=1`。

## 已知 follow-up（不擋 merge；flag 目前 OFF）

- **per-session Google-API 額度** —— `recomputeTravel` / `enrichPoi` / `poiSearch` 會打有計費的 Google API，目前沒有 per-session 上限；被注入的 message 可能在 90 分鐘 session 內燒額度。之後用 `bumpRateLimit` 加一個以 request 為 key 的額度。
- **降級路徑 token 上 argv** —— service token fallback 仍把 token 直接插在 tmux 指令列（既有行為、`ps` 看得到）。之後比照 contained 路徑改走 stdin。
- **contained cwd = repo** —— session 的 cwd 是 repo，Claude 會讀到專案的 `.claude/settings*.json`。裸 tool 的 `deny`（會把整個 tool 從 context 移除）+ `--strict-mcp-config` 已中和目前的 allow；(0b) 冒煙測試會驗證。殘留風險只剩「未來新增、不在 deny 清單裡的 built-in tool」。
