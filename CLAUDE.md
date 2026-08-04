# Tripline

Cloudflare Pages + D1 + React SPA + V2 OAuth. 無全域 admin — owner/permissions + service-token ops scope 授權（admin 移除 v2.55.5-v2.55.7）。

## Pipeline

**Matt Pocock 工作流是預設**（owner 2026-07-25）。gstack 只補 matt 沒有的環節 —— 發版、瀏覽器 QA、安全稽核、回顧。

主線（idea → ship）：

```
grill-with-docs → [多 session? → to-spec → to-tickets →] implement → /ship → /land-and-deploy → /canary
                                                          ↑ 內部驅動 tdd，收尾跑 code-review
```

- **想法要磨** → `/grill-with-docs`（有 codebase、逐題逼問並留痕到 `CONTEXT.md` + ADR）
- **答案要跑起來才知道** → `/handoff` 出去 → `/prototype` → `/handoff` 回來
- **多 session 的 build** → `/to-spec` → `/to-tickets`（tracer-bullet 票 + blocking edges）→ 每票 `/implement`，**每票之間清 context**
- **單 session 就做得完** → 直接 `/implement`
- **收尾**：`/implement` 內部驅動 `/tdd` 逐 seam 紅綠，commit 前跑 `/code-review`（Standards + Spec 雙軸）
- **出貨**：matt 沒有發版流程 → `/ship`（bump VERSION + CHANGELOG + PR）→ `/land-and-deploy` → `/canary`

Context 衛生：步驟 1–3 保持在**同一個不中斷的 context window**，`/to-tickets` 前不要 compact/clear。接近 smart zone（~120k tokens）就 `/handoff` 換新 session，別在退化的狀態硬撐。

On-ramps（匯入主線）：

- **外部湧入的 bug / feature request** → `/triage` → 產出 agent-ready issue → `/implement`。**`/to-tickets` 產的票已經是 agent-ready，不要再 triage。**
- **東西壞了** → `/diagnosing-bugs`（先建一個對這個 bug 會變紅的指令，才准動手修）
- **巨大迷霧 effort**（greenfield / 超出單 session 的大 feature）→ `/wayfinder` 畫決策地圖。**它產決策不產交付物** —— 霧散了交棒到 `/to-spec`，不要直接接 `/implement`。

## ⚠️ Matt skill 的呼叫限制

**13 個 matt skill 有 `disable-model-invocation: true` —— 我不能自主呼叫，只能 owner 打 `/name`。** 主線骨幹全在這裡面，所以**我沒辦法自己起頭**：

`ask-matt` · `grill-with-docs` · `to-spec` · `to-tickets` · `implement` · `triage` · `wayfinder` · `improve-codebase-architecture` · `handoff` · `grill-me` · `teach` · `setup-matt-pocock-skills` · `writing-great-skills`

**我可自主呼叫的 9 個**：`tdd` · `code-review` · `diagnosing-bugs` · `domain-modeling` · `codebase-design` · `prototype` · `research` · `resolving-merge-conflicts` · `grilling`

它們不會出現在 session 的 available-skills 清單裡 —— **那份清單不能拿來判斷有沒有安裝**（2026-07-25 實測誤判過）。要確認裝了什麼就去看 `~/.claude/plugins/cache/mattpocock/mattpocock-skills/*/skills/`。

## Hard Rules

- **Code change → 走 matt 主線**（`/implement`，或先 `/grill-with-docs` 磨清楚）。`/tp-team` 不再支援，請勿呼叫。行程資料用 `tp-*` data skills 直接打 API，不走 code pipeline。
- Feature branch + PR via `/ship`. Never push master directly.
- `tp-*` skills hit API, not local files.
- Agent tool only for worktree isolation（Workflow tool 內部的 `agent()` 不受此限）。
- Web browse: `/browse` only, never `mcp__claude-in-chrome__*`.
- **Mockup-first hard gate**：所有 new page / new component（≥1 layout 變化）→ `/prototype` 的 UI branch 產生可比較 prototype → user sign-off → 才寫 React。Bug fix / token drift / 純 prop tweak / 內部 refactor（無 UX 變化）例外。

## Layout

`src/` SPA · `functions/api/` Pages Functions · `migrations/` D1 · `tests/` · `css/tokens.css` Tailwind 4.

Desktop ≥1024px: 2-col timeline + sticky map. Mobile: 4-tab nav（聊天/行程/地圖/收藏）+ 帳號 header 圓圈 → Account sheet（HIG，見 `docs/plans/apple-hig-compliance/`）。

## Dev

```bash
npm run dev:init   # local SQLite
npm run dev        # vite 5173 + wrangler 8788
```

Mock auth: copy `.dev.vars.example` → `.dev.vars` (NOT `.env.local`), set all three of `ENVIRONMENT=development` + `ALLOW_DEV_MOCK=1` + `DEV_MOCK_EMAIL` (SEC-6 fail-closed guard; 缺一 → `/api/*` 全 500). See `.dev.vars.example`.
Prod `TRIPLINE_API_URL`: funnel listens `:443`, not `:8443`.

## Design SoT

**Apple HIG 是 UI/UX SoT**（iOS 手機 / macOS 桌機：IA、互動、色彩、材質、a11y）。`DESIGN.md` 為衍生、須對齊 HIG；code 不符＝bug，衝突以 HIG 為準（先討論再改 `DESIGN.md`）。**品牌保留例外**：terracotta 受控 tint / Inter web font / timeline editorial no-glass —— HIG 允許，不對齊。合規計畫（spec + 16 W-tickets）見 `docs/plans/apple-hig-compliance/`（**W0–W15 全 2026-07-24 ship 收官**，交付狀態見 `tickets.md`）。此 effort 不使用 mockup 流程。

## Skill Routing

Match → invoke `Skill` first。**matt 優先；同一件事 matt 有就用 matt。**

| 情境 | 用 | 備註 |
|---|---|---|
| 磨想法 / 挑戰決策 | `/grill-with-docs` | 取代 `/office-hours`；留痕到 CONTEXT.md + ADR |
| 收斂成規格 → 拆票 | `/to-spec` → `/to-tickets` | |
| 實作 | `/implement` | 內部跑 `/tdd`，收尾跑 `/code-review` |
| 測試先行 | `/tdd` | 可自主呼叫 |
| Code review | `/code-review` | 取代 `/review`；Standards + Spec 雙軸 |
| Bug / 效能退化 | `/diagnosing-bugs` | 取代 `/investigate`；先建會變紅的指令 |
| 詞彙 / ADR | `/domain-modeling` | CONTEXT.md 的維護者 |
| Module 介面 / seam | `/codebase-design` | |
| 設計問題要跑起來 | `/prototype` | throwaway，留答案刪 code |
| 查資料 | `/research` | 背景 agent，產出有引用的 md |
| Merge 衝突 | `/resolving-merge-conflicts` | |
| Codebase 保養 | `/improve-codebase-architecture` | 產 deepening opportunities |
| 跨 session | `/handoff` | 對話快滿或要分岔時 |

**matt 沒有、繼續用 gstack 的**：

| 情境 | 用 |
|---|---|
| 發版 | `/ship` → `/land-and-deploy` → `/canary` |
| 瀏覽器行為 QA | `/qa` |
| 視覺保真稽核 | `/design-review`（`/qa` 驗行為不驗視覺，兩者不可互相取代） |
| 無頭瀏覽器 | `/browse` |
| 安全稽核 | `/cso --diff` |
| 週回顧 | `/retro` |
| Post-ship 文件同步 | `/document-release` |
| Plan 階段架構審查 | `/plan-eng-review` |
| 已變更程式碼的簡化 | `/simplify` |
| 專案自訂 commit 前檢查 | `/tp-code-verify` |

Detail: `ARCHITECTURE.md`, `GEMINI.md`, `DESIGN.md`, `docs/agents/`.
Prod: https://trip-planner-dby.pages.dev/ · GBrain: pglite + MCP (user scope), sync=full, repo=read-write, 873 pages, setup 2026-05-04. Windows caveat: transcript ingest no-op (script POSIX-only). See `~/.gbrain/config.json`.

## Agent skills

### Issue tracker

Issues 走 GitHub Issues（`raychiutw/trip-planner`），用 `gh` CLI；`/wayfinder` 的 map / child ticket / blocking 也落在這。See `docs/agents/issue-tracker.md`.

### Triage labels

五個角色用預設名稱（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`）；`wontfix` 沿用 repo 既有標籤。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — 根目錄 [`CONTEXT.md`](CONTEXT.md)（領域詞彙 + 已退場名字）+ [`docs/adr/`](docs/adr/)（架構決策，`ARCHITECTURE.md` 只留索引）。探索程式碼前先讀。See `docs/agents/domain.md`.
