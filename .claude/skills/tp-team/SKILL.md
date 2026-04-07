---
name: tp-team
description: Use when starting any code change, feature, bug fix, or refactoring in the trip-planner project. Not for trip data changes — those use tp-* data skills directly.
user-invocable: true
---

# tp-team — 智慧路由 Pipeline v2

code 變更前 invoke 本 skill，自動路由到適合的流程。

## 設計哲學

**按變更規模自動路由，不一刀切。** 30 行 fix 不需要跟 500 行架構變更走同一條路。
`/ship` 已內建 pre-landing review、coverage audit、adversarial review、document-release、TODOS，不重複串。
`/tp-code-verify` 是專案品質底線，所有規模都必跑。

## 路由規則

invoke 本 skill 後，先評估變更規模再決定流程：

```
使用者說「修 X」或「做 Y」
        │
        ▼
   偵測 diff scope + 規模
        │
   ┌────┼────────────┐
   │    │            │
   ▼    ▼            ▼
 MICRO  STANDARD   MAJOR
(<50行)  (50-500行)  (>500行)
```

**規模判斷依據：**
- 預估修改行數（含新增 + 刪除）
- 是否涉及新模組、新 API endpoint、新頁面、架構變更
- 使用者描述的複雜度

**強制升級條件（不論行數）：**
- 新增 migration → 至少 STANDARD
- 新增 API endpoint → MAJOR
- 新增頁面/路由 → MAJOR
- 修改認證/權限邏輯 → MAJOR
- 涉及 3 個以上目錄 → 至少 STANDARD
- 引入新架構模式（SSE、WebSocket、事件驅動等）→ MAJOR

**中途升級：** 實作過程中發現需要 migration 或 scope 超出預期，立即重新評估層級並輸出新的 Pipeline Gate。

## 三層流程

### MICRO（<50 行，單一修復/config/scripts）

```
feature branch → 寫 code → /tp-code-verify → /ship
```

| 步驟 | 做什麼 | 備註 |
|------|--------|------|
| Branch | `git checkout -b fix/描述` | 所有層級第一步都是建 feature branch |
| Build | 寫 code | 直接修 |
| Verify | `/tp-code-verify` | **不可跳過** — tsc + tests + 命名規範 |
| Ship | `/ship` | 內建 review + coverage + adversarial + docs + commit + push + PR |

- `/ship` 內建的 pre-landing review 取代獨立 `/review`
- `/ship` 處理所有 git 操作（commit、push、PR），不需要手動 git add/commit
- 不跑 `/simplify`（diff 太小，review agent 開銷 > 收益）
- `/land-and-deploy` 看情況：純 scripts 修復可跳過，涉及前端/API 則跑

### STANDARD（50-500 行，一般功能/修復）

```
feature branch → 寫 code（TDD）→ /simplify → /tp-code-verify → /ship → /land-and-deploy
```

| 步驟 | 做什麼 | 備註 |
|------|--------|------|
| Branch | `git checkout -b feat/描述` 或 `fix/描述` | |
| Build | 寫 code（TDD：先寫測試再寫實作） | |
| Simplify | `/simplify` — 3 agent 平行審查 | 發現問題就修，修完繼續 |
| Verify | `/tp-code-verify` | **不可跳過** |
| Ship | `/ship` | 內建 review + coverage + adversarial + docs + git |
| Deploy | `/land-and-deploy` | merge + 部署驗證 |
| Monitor | `/canary`（API 或 UI 變更建議跑） | 新 endpoint 也算生產風險 |

### MAJOR（>500 行，架構變更/新功能/新模組）

```
feature branch → /office-hours → /autoplan → 寫 code（TDD）→ /simplify
→ /tp-code-verify → /ship → /land-and-deploy → /canary
```

| 步驟 | 做什麼 | 備註 |
|------|--------|------|
| Branch | `git checkout -b feat/描述` | |
| Think | `/office-hours` | **架構變更強烈建議**，純重構可跳過 |
| Plan | `/autoplan` | CEO + Eng + Design 三審，plan 存在 `~/.gstack/projects/` |
| Build | 寫 code（TDD：先寫測試再寫實作） | 依 plan 順序：migration → backend → frontend → scripts |
| Simplify | `/simplify` | 3 agent 平行審查 |
| Verify | `/tp-code-verify` | **不可跳過** |
| Ship | `/ship` | 全套 review + coverage + adversarial + docs + git |
| Deploy | `/land-and-deploy` | merge + 部署驗證 |
| Monitor | `/canary` | 有 migration 或新 endpoint 時**強烈建議** |

**MAJOR 實作順序指引：**
1. Migration（DB schema 先行）
2. API handler / backend logic
3. Frontend hooks + components
4. Scripts / infra（launchd、cron 等非 web 部署的元件）
5. Tests（或 TDD 穿插在每個步驟）

## 共通機制

### Feature Branch（所有層級第一步）

開始寫 code 之前，必須先建 feature branch：
```bash
git checkout -b fix/簡短描述   # MICRO bug fix
git checkout -b feat/簡短描述  # STANDARD/MAJOR 新功能
```
禁止在 master 上直接寫 code。

### Git Workflow（所有層級）

**不需要手動 git add/commit/push。** `/ship` 統一處理：
- 分析 diff，拆成 bisectable commits
- 自動 bump VERSION + CHANGELOG
- Push + 建立 PR

如果 `/ship` 之前需要中途存檔（大型變更），可手動 commit：
```bash
git add -A && git commit -m "wip: 描述"
```

### Verify 失敗處理（所有層級）

`/tp-code-verify` 失敗時：
1. 讀取失敗訊息，判斷是**本 branch 引入**還是 **pre-existing**
2. 本 branch 引入 → 修復後重跑 `/tp-code-verify`，直到全過
3. Pre-existing → 記錄在 PR body，不阻擋 ship（但建議修）
4. 無限迴圈上限：3 次修復後仍失敗 → 停下來問使用者

### /simplify 發現問題時（STANDARD + MAJOR）

1. `/simplify` 的 3 個 agent 回報問題
2. 修復所有合理的建議（忽略 false positive）
3. **不需要重跑 /simplify**，直接進入 `/tp-code-verify`
4. `/tp-code-verify` 會重新驗證所有修改

### Rollback 計畫

如果 `/land-and-deploy` 或 `/canary` 發現問題：
- **無 migration 的變更：** `git revert` + 重新部署
- **有 migration 的變更：** 評估 migration 是否可逆（DROP 不可逆），必要時寫 reverse migration
- **launchd / scripts：** 手動 `launchctl unload` 還原 plist
- `/canary` 發現問題時會自動提供 revert 選項

## 週期性任務（排程，非 per-PR）

| 任務 | 頻率 | 觸發方式 |
|------|------|---------|
| `/retro` | 每週一次 | 手動或排程 |
| `/cso` | 每週或每次 release | 手動 |
| `/health` | 需要時 | 手動 |
| `/benchmark` | UI 變更後 | 手動 |

## Multi-Session 交接（MAJOR 限定）

MAJOR 變更可能跨多個 session。當 context 接近上限時：

1. 用 `/checkpoint` 儲存進度（自動記錄 git state + 決策 + 剩餘工作）
2. 下個 session 開始時，`/checkpoint` 自動恢復 context
3. 如果沒有 `/checkpoint`，手動記錄：
   - 哪些步驟已完成
   - 目前在 pipeline 哪個階段
   - 下一步要做什麼

**原則：一個 session 完成一個完整步驟。** 不要在 Build 做到一半時中斷。

## Pipeline Commitment Gate

路由決定後，輸出對應的階段確認：

**MICRO:**
```
✅ Branch  — git checkout -b fix/描述
✅ Build   — 寫 code
✅ Verify  — /tp-code-verify ← 不可跳過
✅ Ship    — /ship（內建 review + coverage + adversarial + docs + git）
```

**STANDARD:**
```
✅ Branch  — git checkout -b feat/描述
✅ Build   — 寫 code（TDD）+ /simplify
✅ Verify  — /tp-code-verify ← 不可跳過
✅ Ship    — /ship（內建 review + coverage + adversarial + docs + git）
✅ Deploy  — /land-and-deploy + /canary（API/UI 變更建議）
```

**MAJOR:**
```
✅ Branch  — git checkout -b feat/描述
✅ Think   — /office-hours（架構變更強烈建議）
✅ Plan    — /autoplan → 三審，plan 存 ~/.gstack/projects/
✅ Build   — 寫 code（TDD）+ /simplify
✅ Verify  — /tp-code-verify ← 不可跳過
✅ Ship    — /ship（內建 review + coverage + adversarial + docs + git）
✅ Deploy  — /land-and-deploy → /canary（強烈建議）
```

## 鐵律

1. **`/tp-code-verify` 不可跳過** — 所有規模都必須通過 tsc + tests + 命名規範
2. **必須走 feature branch + PR** — 開始寫 code 前先建 branch
3. **test fail 必須解決** — Ownership Triage：本 branch 引入 vs pre-existing
4. **scope drift detection** — `/ship` 內建，比對 stated intent vs actual diff
5. **context 快滿了** → `/checkpoint` 或手動存進度，下個 session 接續
6. **中途發現 scope 超出** → 重新評估層級，升級流程

## Red Flags — 看到這些想法時 STOP

| 想法 | 現實 |
|------|------|
| 「太簡單不需要 /tp-code-verify」 | ❌ 一行 CSS 也要過 verify |
| 「先改再補流程」 | ❌ 先建 branch + 輸出 Gate 再動手 |
| 「直接 push master 比較快」 | ❌ 必須走 feature branch + PR |
| 「test fail 先跳過」 | ❌ 必須做 Ownership Triage |
| 「MICRO 不需要 tests」 | ❌ `/tp-code-verify` 包含跑測試 |
| 「架構大改不需要 /office-hours」 | ❌ 架構變更強烈建議跑 Think 階段 |

## 按需 skill（不在 pipeline 內，需要時 invoke）

| gstack skill | 角色 | 何時用 |
|-------------|------|--------|
| `/investigate` | Systematic Debugger | bug 調查（自動 /freeze 限制範圍） |
| `/design-review` | Senior Designer + Frontend Engineer | 視覺稽核 + CSS 修復 |
| `/design-consultation` | Senior Product Designer | 建立設計系統（產出 DESIGN.md） |
| `/design-shotgun` | Design Explorer | 方向不確定時出多個設計方案比較 |
| `/qa` / `/qa-only` | QA Engineer | 手動或自動化 QA 測試 |
| `/browse` | QA Tester | 手動瀏覽器測試 |
| `/setup-browser-cookies` | Session Manager | 匯入真實瀏覽器 cookie |
| `/careful` / `/freeze` / `/guard` | Safety | 破壞性指令護欄 + 限制編輯範圍 |
| memory system | Knowledge Manager | 跨 session 經驗管理 |

## tp-* Skill（行程資料操作，不走 pipeline）

`/tp-request` `/tp-create` `/tp-edit` `/tp-check` `/tp-rebuild` `/tp-patch`

**判斷原則：改 code → 走智慧路由 pipeline；改行程資料 → 直接操作。**
