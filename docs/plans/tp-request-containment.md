# tp-request 雙層 containment（activation 前置 (0)）

**Status:** ✅ **BUILT** 2026-07-11 (branch `feat/tp-request-containment`, T1-T6) · 2-agent adversarial review + /cso --diff clean · unit 3660 + api 1075 green · **Scope:** one PR · **Feature:** stays inert (`TP_REQUEST_USER_TOKEN` OFF) · **Fail-closed:** 未設 tp-agent/sudo/self-probe → 降級 read-only service token · **Ray-manual:** (0a) tp-agent user + sudoers + perms, (0b) pre-activation smoke test — see `scripts/tp-request-contained/README.md`

_eng-review + outside-voice(security-auditor) locked the plan 2026-07-11; built same day. Review findings all fixed in-PR (enrichPoi tripId, negative self-probe, --strict-mcp-config, profile guard, reply cap). Follow-ups: per-session Google-API budget, degrade-path token-on-argv._

## 為什麼

v2.55.56（PR #1023）給 tp-request ephemeral session「restrict_trip-scoped」token，但那是 **API 層 defense-in-depth，不是 containment**。session 是 Claude REPL、與 api-server 同 OS user、被 `trip_requests.message`（untrusted）prompt-inject 後可讀 ambient creds 重 mint 無限制 token。開 flag 前的硬前提。

## Threat model（outside-voice 修正版）

| 路徑 | 動作 | 結果 | 關鍵 |
|------|------|------|------|
| P1 | 讀 `~/.tripline/user-token-state.json` | refresh token 重 mint | 檔案 |
| P2a | 讀 `.env.local` client secret | 重 mint | 檔案 |
| **P2b** | **讀 `process.env`（繼承 api-server）** | **service secret → 跨租戶摧毀** | **env — sandbox 擋不到** |
| P3 | 跑 token 腳本 | 內部 P1/P2 | 檔案 |
| P4 | 網路外送 / reply 欄回填 | exfil scoped 資料 | 網路 |

**P2b 是 auditor 抓到的 CRITICAL**：`spawnSync` 無 env scrub → child 繼承 `TRIPLINE_API_CLIENT_SECRET`（service client → `client_credentials` 拿全 scope → `ops:trips:read` 讀所有 trip + `ops:poi` → `DELETE /api/pois/{id}` 共享 POI → **跨租戶行程摧毀，零檔案存取**）。

## 選定方案：separate unix user（layer A）+ B-full（layer B）+ env-scrub

```
              untrusted trip_requests.message → prompt injection
                              ▼
   ┌──────────────────────────────────────────────────────┐
   │ Claude REPL — runs as unix user `tp-agent`            │
   │                                                        │
   │ B-full 能力層: --permission-mode dontAsk               │
   │   allow  mcp__tripline__*   (只此,無 WebSearch)        │
   │   deny   Bash ← LOAD-BEARING (dontAsk 放行 read-only   │
   │          bash;拿掉這行 env/cat 就能跑)                 │
   │   deny   Write Edit WebFetch Glob Grep Agent Task       │
   │   settings 走 repo 覆蓋不了的 --settings                │
   └───────────────────────┬────────────────────────────────┘
                           │ (即使能力層有洞…)
   ┌───────────────────────▼────────────────────────────────┐
   │ A OS 層: unix user perms（非 deprecated seatbelt）      │
   │   env -i 乾淨環境 → 無 Ray secrets 進 process           │
   │   ~ray/.tripline(700) .env.local(600) token-cache(600)  │
   │     owner=ray → tp-agent 讀不到（FS 權限，非 profile）  │
   └───────────────────────┬────────────────────────────────┘
                           ▼
             tripline API (host 寫死) — restrict_trip token
```
要提權/外洩，得**同時**踩破 dontAsk allowlist **且** FS 權限**且** env-scrub。env 洞被 FS 乾淨 login env + `env -i` 結構性關掉。

## (0a) 系統設定前提（Ray-manual，需 root — code 在此之前 fail-closed）
1. 建 unix user `tp-agent`（`sysadminctl -addUser tp-agent`）。
2. sudoers NOPASSWD + `!requiretty`：ray 可 `sudo -u tp-agent` 跑指定 claude 指令（`/etc/sudoers.d/tp-request`）。
3. 權限稽核：repo 對 tp-agent 可讀+執行（跑 claude/node/MCP）；`.env.local`(600 ray)、`~ray/.tripline`(700)、token cache 不可讀。
4. 驗證：`sudo -u tp-agent true` 免密通過；`sudo -u tp-agent cat <repo>/.env.local` → Permission denied。

## Components（code — 本 PR）

### 1. tripline MCP server（新，跑為 tp-agent）
- stdio，暴露 `security.md` ✅ ~20 操作，**一操作一 tool**（無 method/url/raw 參數）。
- 認證用**注入的** `TRIPLINE_API_TOKEN` + `TRIPLINE_RESTRICT_TRIP`；host 寫死。
- 每 tool 斷言 `tripId === RESTRICT_TRIP`（belt-and-suspenders；真正 IDOR gate 是 `verifyEntryBelongsToTrip`，已在）。
- `❌` 操作不暴露。401 → tool error 不 crash。**reply 長度 cap**（限外洩頻寬）。

### 2. spawn 改（`tripline-api-server.ts:380`）
```
sudo -u tp-agent /usr/bin/env -i \
  PATH=… HOME=/Users/tp-agent TMPDIR=<專屬空 dir> TERM= LANG= \
  CLAUDE_CONFIG_DIR=<disposable,自毀時清> \
  TRIPLINE_API_TOKEN=<restrict> TRIPLINE_RESTRICT_TRIP=<id> \
  claude --permission-mode dontAsk --settings <repo 外> --mcp-config <tripline>
```
- **env -i allowlist** → `.env.local` secrets 不進 process（P2b 修）。
- **fail-closed**：`sudo -u tp-agent true` 失敗 / MCP 起不來 → 退 service-token 唯讀；**絕不**退 uncontained curl+skip-permissions。

### 3. startup self-probe（session 內，防 silent-open）
session 一啟動先自測：試讀 `~ray/.tripline` + 試一個 denied tool。任一意外成功 → 自毀 session + alert。（profile 有洞 / claude 升級改 tool 分類 → 當場抓，非靠 point-in-time 測試。）

### 4. API fix — poi-favorites restrict（修 v2.55.56 shipped 的洞，auditor HIGH）
`poi-favorites.ts:43-44` 走 `auth.userId` path，restrict_trip 三 chokepoint 沒覆蓋 → restricted token（user_id=owner）可列舉/刪 owner 全跨 trip 收藏。**修**：user-path 補 `assertNotTripRestricted(auth)`，或 restrict 模式不曝 favorites tools。（此為 API 層修，非 MCP。）

### 5. tp-request 技能重寫（整個執行模型）
現況全靠 shell/node（`:36` env eval、`:43` token mint、`:94` /tmp 寫、`:275` node -e JSON、20 curl）→ dontAsk+deny-Bash 下全壞。每項改 MCP tool 或砍：env/token → 砍（MCP 自持）；JSON → tool typed 參數；`/tmp/status.json` → api-server 無 consumer（grep 確認）故砍，需要則加 MCP status tool；讀請求/行程 → MCP tool。`SKILL.md`+`reply-format.md`+`security.md` 同步。

## deny-list 說明（auditor MEDIUM）
dontAsk 下 non-allow 已 auto-deny → 多數 deny 是裝飾，**唯一 load-bearing 是 `deny: Bash`**（dontAsk 放行 read-only bash）。標註「不可 simplify 掉」+ 測 `env` 被擋。allow 嚴格只 `mcp__tripline__*`。

## Build 順序
1. poi-favorites fix（API，可獨立測）→ 2. MCP server → 3. 技能重寫 → 4. spawn 接線（sudo/env-i/dontAsk/settings/self-probe/fail-closed）。

## 測試
- **MCP 單元**：每 tool 打對 endpoint+Bearer;`tripId≠RESTRICT` 拒;`❌` 不存在;401 不 crash;reply cap。
- **poi-favorites restrict**：restricted token GET/DELETE favorites → 403（回歸測，鎖 auditor HIGH）。
- **env-scrub 探針**：session 內 assert `TRIPLINE_API_CLIENT_SECRET` 等**不在** `process.env`。
- **FS 權限探針**：`sudo -u tp-agent cat .env.local / ~ray/.tripline/* / token-cache` → Permission denied。
- **dontAsk 探針**：試 Bash(`env`)/Read/Task → auto-deny 不 prompt;`mcp__tripline__*` 過。
- **settings 權威**：repo 塞 `.claude/settings.json` 加 allow → 不生效（--settings 勝）。
- **fail-closed**：tp-agent/sudo 未設 → 不 spawn user session,退 service 唯讀。
- **self-probe**：注入假洞（可讀 secret）→ session 自毀。
- **整合 + adversarial**：受控 session 寫 entry✓ / cat creds✗ / env secret✗ / 外送✗ / spawn sub-agent✗;security-auditor 逃逸測。

## NOT in scope
- sandbox-exec（被 separate-user 取代 — 非 deprecated、且結構性關 env）。B-lite（被 B-full 取代）。
- 網路 host-allowlist。reply 欄「單 trip 內容外洩給該 trip member」= feature 固有隱私決定，接受 in-scope + reply cap，非 containment 未解。
- provision / seed / 開 flag / (0a) 系統設定 — Ray-manual。

## 已存在（reuse）
restrict_trip mint/enforce（v2.55.56）· ✅ API endpoints（MCP wrap，無新 API）· spawn/tmux 架構（改 :380）。

## 確認 OK（auditor，不 re-litigate）
matching-tripId IDOR 已擋（`verifyEntryBelongsToTrip`）· downscope 自我提權已擋 · owner-ops 有 `assertNotTripRestricted` · 完整 user token 不進 claude · dontAsk 機制正確。

## 風險
- (0a) sudo spawn-as-user unattended 可行性 — **Build 前 Ray 先驗** `sudo -u tp-agent true`;不行則整個 layer A 卡住。
- MCP server = 新信任邊界:over-broad 參數 / response-injection → 必測。
- 技能重寫遺漏某 shell 依賴 → dontAsk 下 auto-deny 靜默失敗 → e2e 必須覆蓋。
- ~/.claude transcript 落 secret → disposable CLAUDE_CONFIG_DIR 自毀時清 + secret 不進 tool arg。
