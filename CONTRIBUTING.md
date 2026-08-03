# Contributing

新手上路指南。跑過一遍就能動手改 code。

## Prerequisites

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 22+ | vite, wrangler, vitest (CI 用 22, package.json `engines`) |
| npm | 10+ | 隨 Node 來的那個就行 |
| bun | 1.0+ | google-poi-*.ts scripts (cron backfill / refresh / quota monitor) |
| git | 任何近代版本 | — |
| [gh CLI](https://cli.github.com/) | 任何 | 開 PR、查 CI |
| AI coding agent | — | 依 `AGENTS.md` 執行專案工作流（非必須）|

Cloudflare Wrangler 不用先裝，`npm install` 會帶進來。

## 從零開始

```bash
# 1. clone + install
git clone https://github.com/raychiutw/trip-planner.git
cd trip-planner
npm install

# 2. 建本機 D1（會從 production dump 還原一份 SQLite 到本機）
npm run dev:init

# 3. 啟動 dev server（vite 5173 + wrangler pages dev 8788）
npm run dev
```

打開 http://localhost:5173 — 看到行程首頁就成功。

### `.dev.vars`

API 需要身份模擬。**用 `.dev.vars` 不是 `.env.local`** — wrangler pages dev
只讀前者；後者只有 vite 讀，wrangler 完全看不到。

```bash
# .dev.vars (放在 project root)
# 本機 mock 認證用（V2 OAuth 之前是 Cloudflare Access；v2.32+ 改 session cookie，
# DEV_MOCK_EMAIL 仍跳過 prod auth flow 給 dev 用）
# 三者缺一 → SEC-6 fail-closed guard deny，/api/* 全 500（見 _middleware.ts:299-302）。
ENVIRONMENT=development
ALLOW_DEV_MOCK=1
DEV_MOCK_EMAIL=you@example.com
```

複製範本：`cp .dev.vars.example .dev.vars`。

沒設會以 anonymous 身份跑，能讀已發布的 trips，不能寫。

**Prod 安全**: `_middleware.ts:241-247` 守衛靠 `env.ENVIRONMENT === 'production'`
拒絕 `DEV_MOCK_EMAIL` 生效 (v2.33.60+ 此 var 在 wrangler.toml [env.production.vars]
強制聲明)。

## 每次改 code 前

**先讀 [AGENTS.md](AGENTS.md)。** 本專案以 Matt Pocock 官方技能鏈為預設：依工作規模走 `/grill-with-docs → /to-spec → /to-tickets → /implement → /code-review`，再套用 Tripline 的 feature branch、驗證與 PR 規則；小型且已定案的單一 session 變更可直接進 `/implement`。

## 測試

```bash
npm run typecheck          # TypeScript 零錯誤
npm run typecheck:functions  # Pages Functions 型別檢查
npm test                   # vitest unit + integration（實測耗時見下方說明，數量看它自己的輸出）
npm run test:api           # Pages Functions integration（miniflare + 真 D1）
npm run test:e2e           # Playwright（要先開 dev server）
npm run test:all           # = npm test + npm run test:api
```

**`npm test` 不便宜，別當成隨手跑一次沒成本。** 本機實測約 **80–90 秒**（2026-07-25 快照，Apple Silicon）。原因是 `--maxWorkers=2` 限流 —— 每個 worker 都要各自建 Miniflare D1 並跑 90+ 個 migration，滿並行度下會撞 timeout。這是權宜之計，根本解（共用一份已 migrate 的 D1 快照）記在 [`TODOS.md`](TODOS.md) 的「測試套件 — D1 建置成本迫使 unit 限流 2 worker」。

測試數量刻意不寫死在這裡 —— 它每週都在變，寫下來就會腐爛。要知道規模直接看 `npm test` 的輸出。

### 測試分層

- **unit** (`tests/unit/`) — 純邏輯 / lib / hooks / 元件 render
- **api** (`tests/api/`) — Pages Functions endpoint，跑在 miniflare 上
- **e2e** (`tests/e2e/`) — Playwright，完整使用者流程

### 什麼情況要加測試

本 repo 採 TDD：**任何 production code 變更必須先有對應失敗測試**。

- 新函式 → 新 unit test
- 修 bug → 先寫一個能重現 bug 的 failing test，再修
- 新 endpoint → 新 api integration test
- 新使用者流程 → 新 e2e test
- 改 conditional（`if/else`、`switch`）→ 兩條路徑都要測
- 改 error handler → 測能觸發 error 的 case

## Commit & Branch

### Branch 命名

```
feat/<短描述>    新功能
fix/<短描述>     bug 修復
refactor/<>     重構（行為不變）
docs/<>         文件
test/<>         只加測試
chore/<>        建置 / 工具 / 格式
```

### Commit Message

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <短標題，繁體中文>

<可選 body，解釋 WHY>
```

`<type>` 用 `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style` / `perf`。

範例：

```
fix(daynav): scroll spy 閾值從 navH+10 改為視窗上 1/3

Bug：右上角 DayNav active pill 與視覺主畫面不同步...
```

### PR 流程

```bash
# 1. 開 branch + 做事
git checkout -b fix/my-bug

# 2. 跑工作流（完整規則見 AGENTS.md）
#    本地至少確保：
npm run typecheck && npm test

# 3. 開 PR（如果裝了 gh CLI）
gh pr create --base master --title "fix: ..." --body "..."
```

**禁止直接 push master。** 必須走 feature branch + PR。

## 專案結構速查

完整架構見 [ARCHITECTURE.md](ARCHITECTURE.md)。速查版：

```
src/
├── entries/main.tsx      SPA 入口
├── pages/                TripPage / ManagePage / AdminPage
├── components/           trip/ + shared/
├── hooks/                useTrip / useDarkMode / usePrintMode ...
├── lib/                  apiClient / mapRow / scrollSpy ...
└── types/

functions/api/            Cloudflare Pages Functions（TS）
migrations/               D1 schema（0001 ~ 00NN，idempotent）
css/tokens.css            唯一 CSS 檔（Tailwind 4 @theme）
tests/                    unit / api / e2e
scripts/                  init-local-db, dump-d1, daily-check, poi-enrich-batch ...
src/server/               jwt / oauth-d1-adapter / password / email / session / invitation-token / hkdf / email-utils / maps/google-client / oauth-server/ / oauth-client/ (v2.23.0+ Google Maps + V2 OAuth)
```

## 常見任務速查

| 任務 | 指令 |
|------|------|
| 啟動本機開發 | `npm run dev` |
| 重建本機 D1 | `npm run dev:reset`（會清空再重建）|
| 型別檢查 | `npm run typecheck` |
| 跑所有測試 | `npm run test:all` |
| 看某個 hook 有什麼測試 | `ls tests/unit/ \| grep -i <hook-name>` |
| 新增 migration | 在 `migrations/` 加新檔 `00NN_<名稱>.sql`，用 `IF NOT EXISTS` |
| 查 API log | 上 production D1：`wrangler d1 execute trip-planner-db --remote --command "SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 10"` |

## 遇到問題

1. **本機 API 500 錯誤** — `npm run dev:reset` 重建本機 D1。若仍失敗，檢查 `.dev.vars` 是否存在。
2. **測試 flaky** — 跑 `npm test -- --run <file>` 單檔重跑；仍 flaky 的話回報 issue，不要 retry 掩蓋問題。
3. **CF Pages build 失敗** — 多半是 `vite build` 出錯或 migration 沒 idempotent。看 GitHub Actions log。
4. **Playwright 找不到 element** — 本機 POI 資料可能缺失。v2.29.0 後 POI 走 `pois` master + `trip_entry_pois` junction (trip_pois 已 DROP)。用 production URL 跑 e2e，或重建本機 D1。

## 其他文件

- [README.md](README.md) — 使用者介紹
- [ARCHITECTURE.md](ARCHITECTURE.md) — 系統架構
- [DESIGN.md](DESIGN.md) — 設計系統
- [AGENTS.md](AGENTS.md) — 開發工作流與發布規則
- [CLAUDE.md](CLAUDE.md) — 專案事實、命名歷史與 agent 規則
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
- [TODOS.md](TODOS.md) — 已知待辦

歡迎開 issue 或 PR。
