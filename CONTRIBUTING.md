# Contributing

新手上路指南。跑過一遍就能動手改 code。

## Prerequisites

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | vite, wrangler, vitest |
| npm | 10+ | 隨 Node 來的那個就行 |
| git | 任何近代版本 | — |
| [gh CLI](https://cli.github.com/) | 任何 | 開 PR、查 CI |
| [Claude Code](https://claude.com/claude-code) | 最新版 | 跑 gstack pipeline（非必須，但工作流建議用）|

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

### `.env.local`

API 需要身份模擬，建一份 `.env.local`：

```bash
# 本機 mock 認證用（跳過 Cloudflare Access）
DEV_MOCK_EMAIL=you@example.com
```

沒設會以 anonymous 身份跑，能讀已發布的 trips，不能寫。

## 每次改 code 前

**先讀 [CLAUDE.md](CLAUDE.md)。** 本專案用 gstack 的七階段 pipeline（Think → Plan → Build → Review → Test → Ship → Reflect），不是「改完推上去」那種節奏。`/tp-code-verify` 和 `/review` 不可跳過。

## 測試

```bash
npm run typecheck          # TypeScript 零錯誤
npm run typecheck:functions  # Pages Functions 型別檢查
npm test                   # vitest unit + integration（~4s，跑 409+ tests）
npm run test:api           # Pages Functions integration（miniflare + 真 D1）
npm run test:e2e           # Playwright（要先開 dev server）
npm run test:all           # = npm test + npm run test:api
```

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

# 2. 跑 pipeline（完整 pipeline 見 CLAUDE.md）
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
scripts/                  init-local-db, dump-d1, daily-check ...
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

1. **本機 API 500 錯誤** — `npm run dev:reset` 重建本機 D1。若仍失敗，檢查 `.env.local` 是否存在。
2. **測試 flaky** — 跑 `npm test -- --run <file>` 單檔重跑；仍 flaky 的話回報 issue，不要 retry 掩蓋問題。
3. **CF Pages build 失敗** — 多半是 `vite build` 出錯或 migration 沒 idempotent。看 GitHub Actions log。
4. **Playwright 找不到 element** — 本機 POI 資料可能缺失（`trip_pois=0 rows`）。用 production URL 跑 e2e，或重建本機 D1。

## 其他文件

- [README.md](README.md) — 使用者介紹
- [ARCHITECTURE.md](ARCHITECTURE.md) — 系統架構
- [DESIGN.md](DESIGN.md) — 設計系統
- [CLAUDE.md](CLAUDE.md) — 開發 pipeline
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄
- [TODOS.md](TODOS.md) — 已知待辦

歡迎開 issue 或 PR。
