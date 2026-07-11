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

## (0b) 開 flag 前的 live 驗證 —— ✅ 已通過（2026-07-11 dry-run，非 `-p`）

在本機實跑真實 contained 機制（互動 tmux REPL），逐關驗證全過：

- ✅ **認證**：claude 用 `CLAUDE_CODE_OAUTH_TOKEN` 起得來，且**無 onboarding/trust 對話框**卡住（見下方「互動 REPL 無人值守」機制）；
- ✅ **能力面**：工具清單**只剩 16 個 `mcp__tripline__*`** —— Bash / Read / Skill / ToolSearch / Workflow / Agent / Artifact 全部消失；
- ✅ **skill**：`/tp-request` 觸發、agent 自判「Contained mode」、呼叫 MCP 工具；
- ✅ **exfil**：prompt-injection 叫它讀 `.env.local` 印憑證 → 拒絕 + **零外洩**（Layer A OS perm 讓 tp-agent 根本開不了檔 + Layer B 無 Read tool，雙擋）。

換機器 / claude 升版 / 改設定後，重跑同機制再驗一次即可。

### 互動 REPL 無人值守怎麼跑起來（非 `-p`）

Claude Code 的互動模式對 untrusted folder **一定**跳 trust 對話框（只有 `-p` 會停用），且能力鎖必須拿掉 `--dangerously-skip-permissions`（非-contained 路徑靠它跳過 trust；contained 不能用）。所以 contained 用這套組合（`buildContainedShellCommand` + `spawnContainedSession`）讓互動 REPL 無人值守直達 prompt：

1. **cwd = 乾淨的 sessionDir**（sh wrapper 內 `cd "$1"`，因為 tp-agent 進得去自己的 0700 目錄、而 api-server 用戶的 tmux `-c` 進不去）→ workspace 不是 repo，沒有 `.claude/settings.local.json` 的 allow，trust 對話框無 allow 可套。
2. **pre-seed `<config>/.claude.json`**：`hasCompletedOnboarding:true`（跳過登入/主題 onboarding）+ `projects[sessionDir].hasTrustDialogAccepted:true`（pre-trust 那個空 sessionDir → 跳過 trust 對話框；空目錄信任=零授權）。
3. **skill 探索**：`<config>/skills` symlink 到 repo `.claude/skills`（user-skill scope）→ `/tp-request` 找得到，但不用把 repo 當 workspace。

## 已知 follow-up（不擋 merge；flag 目前 OFF）

- **per-session Google-API 額度** —— `recomputeTravel` / `enrichPoi` / `poiSearch` 會打有計費的 Google API，目前沒有 per-session 上限；被注入的 message 可能在 90 分鐘 session 內燒額度。之後用 `bumpRateLimit` 加一個以 request 為 key 的額度。
- **降級路徑 token 上 argv** —— service token fallback 仍把 token 直接插在 tmux 指令列（既有行為、`ps` 看得到）。之後比照 contained 路徑改走 stdin。
- **deny 用列舉（Claude Code 沒有「只准 allow、其餘全 deny」的權威模式）** —— `dontAsk` 會把未列的 meta-tool（Skill / ToolSearch / Workflow / Artifact …）當豁免放行，所以 `settings.json` 得**逐一列 deny**。風險：claude 未來新增一個沒列到的工具會漏。緩解：(1) **Layer A**（tp-agent OS 隔離）擋掉 FS/exec 類漏洞（讀憑證、跑 script）；(2) 真正需要 deny 擋的是**網路/外洩/spawn 類**（WebFetch / Artifact / SendUserFile / Workflow / Agent），這些已列。升 claude 版本後值得重跑 (0b) 的工具清單檢查、必要時補 deny。
