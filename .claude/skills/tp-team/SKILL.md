---
name: tp-team
description: Use when starting any code change, feature, bug fix, or refactoring in the trip-planner project. Not for trip data changes — those use tp-* data skills directly.
user-invocable: true
---

# tp-team — gstack Sprint Pipeline

**Claude 直接做事，invoke 不同 gstack skill 換帽子。** code 變更前 invoke 本 skill，確認完整 pipeline。

## 設計哲學

**遵循 gstack 官方七階段流程。** 每個階段是一個 gstack skill，前一階段的輸出自動成為下一階段的 context。不自創路由，不跳階段。

`/tp-code-verify` 是本專案加在 Build 後的品質 gate，其餘全走 gstack 標準流程。

## 七階段 Pipeline

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| 階段 | gstack skill | 做什麼 | 可跳過？ |
|------|-------------|--------|---------|
| Think | `/office-hours` | 探索需求，產出 design doc | bug fix 可跳 |
| Plan | `/autoplan` | CEO + Eng + Design 三審一鍵完成 | trivial fix 可跳 |
| Build | 寫 code + `/simplify` | TDD + 3 agent 平行審查 | 不可跳過 |
| Review | `/tp-code-verify` → `/review` | 專案規範 gate + staff engineer diff 審查 | **不可跳過** |
| Test | `/cso --diff` + `/qa`（UI 變更） | 安全掃描 + 瀏覽器 QA | `/cso --diff` 不可跳 |
| Ship | `/ship` → `/land-and-deploy` → `/canary` | PR + merge + 部署 + 監控 | `/ship` 不可跳 |
| Reflect | `/retro` | 回顧（weekly 排程或手動） | 使用者授權跳過 |

## 每個階段詳解

### 1. Think — `/office-hours`

產出 design doc，存在 `~/.gstack/projects/`，後續階段自動讀取。

**什麼時候跑：** 新功能、架構變更、不確定怎麼做的需求。
**什麼時候跳：** 明確的 bug fix、config 調整、已知範圍的修改。

### 2. Plan — `/autoplan`

一鍵跑完 CEO + Design + Eng 三審。自動做決策，只在有爭議的 taste decision 時才停下來問你。

**什麼時候跑：** 涉及架構選擇、多個實作方案、跨模組變更。
**什麼時候跳：** 單一檔案修復、已有明確 plan 的任務。

### 3. Build — 寫 code + `/simplify`

先建 feature branch，TDD 開發，完成後跑 `/simplify`（3 agent 平行審查 reuse / quality / efficiency）。

```bash
git checkout -b feat/描述  # 或 fix/描述
```

**Build 順序指引（多元件變更時）：**
1. Migration（DB schema 先行）
2. API handler / backend logic
3. Frontend hooks + components
4. Scripts / infra

`/simplify` 發現問題就修，修完直接進下一階段。

### 4. Review — `/tp-code-verify` → `/review`

**兩步都不可跳過。**

**`/tp-code-verify`**（本專案特有 gate）：
- `npx tsc --noEmit` — TypeScript 零錯誤
- `npm test` + `npm run test:api` — 548+ tests 全過
- 命名規範（camelCase / kebab-case / UPPER_SNAKE）
- CSS HIG 規則（src/ 或 css/ 有變更時）
- React Best Practices（src/ 有變更時）

**`/review`**（gstack 標準 diff 審查）：
- SQL & Data Safety
- Race Conditions
- LLM Trust Boundary
- Specialist dispatch（testing, security, performance...）
- Adversarial review（Claude subagent）

**失敗處理：**
1. 本 branch 引入 → 修復後重跑，直到全過（上限 3 次）
2. Pre-existing → 記錄在 PR body，不阻擋

### 5. Test — `/cso --diff` + `/qa`

**`/cso --diff`**（不可跳過）：
- diff-scoped 安全掃描，secrets / injection / OWASP

**`/qa`**（UI 變更時跑）：
- 瀏覽器 QA 測試 + bug fix with atomic commits

**`/benchmark`**（UI 效能變更時跑）：
- Core Web Vitals baseline comparison

### 6. Ship — `/ship` → `/land-and-deploy` → `/canary`

**`/ship`**（不可跳過）：
- 必須走 feature branch + PR
- 內建 pre-landing review + coverage audit + adversarial review
- 自動 bump VERSION + CHANGELOG
- 自動跑 `/document-release`（docs 同步）
- `/ship` 處理所有 git 操作（commit、push、PR）

**`/land-and-deploy`**：
- merge PR + 等 CI + 部署驗證

**`/canary`**（有 migration 或新 endpoint 時建議跑）：
- 部署後監控 console errors + performance

### 7. Reflect — `/retro`

每週一次回顧，分析 commit patterns + test health + shipping velocity。
可手動觸發或排程。

## Pipeline Commitment Gate

invoke 本 skill 後，輸出完整七階段確認：

```
✅ Think   — /office-hours（新功能/架構跑，bug fix 跳過）
✅ Plan    — /autoplan（多方案/跨模組跑，trivial 跳過）
✅ Build   — feature branch + 寫 code（TDD）+ /simplify
✅ Review  — /tp-code-verify + /review ← 不可跳過
✅ Test    — /cso --diff ← 不可跳過 | /qa（UI 變更）
✅ Ship    — /ship → /land-and-deploy → /canary
✅ Reflect — /retro（weekly 或手動）
```

然後根據任務性質，標記哪些階段跳過並說明原因。

## 鐵律

1. **`/tp-code-verify` + `/review` 不可跳過** — 所有變更都必須通過
2. **`/cso --diff` 不可跳過** — 每次 PR 都掃安全
3. **必須走 feature branch + PR** — 禁止直接 push master
4. **test fail 必須解決** — Ownership Triage：本 branch 引入 vs pre-existing
5. **context 快滿了** → `/checkpoint` 存進度，下個 session 接續

## Red Flags — 看到這些想法時 STOP

| 想法 | 現實 |
|------|------|
| 「太簡單不需要 /review」 | ❌ 一行 CSS 也走 Review |
| 「太簡單不需要 /tp-code-verify」 | ❌ 所有變更都要過 |
| 「先改再補流程」 | ❌ 先建 branch + 輸出 Gate 再動手 |
| 「直接 push master」 | ❌ 必須走 feature branch + PR |
| 「/cso 太慢跳過」 | ❌ `--diff` 模式很快，不可跳 |
| 「test fail 先跳過」 | ❌ 必須做 Ownership Triage |

## 按需 skill（不在 pipeline 內，需要時 invoke）

| gstack skill | 何時用 |
|-------------|--------|
| `/investigate` | bug 調查（自動 /freeze 限制範圍） |
| `/design-review` | 視覺稽核 + CSS 修復 |
| `/design-consultation` | 建立設計系統 |
| `/design-shotgun` | 多個設計方案比較 |
| `/qa-only` | 純報告不修改 |
| `/browse` | 手動瀏覽器測試 |
| `/health` | code quality dashboard |
| `/benchmark` | 效能 regression detection |
| `/careful` / `/freeze` / `/guard` | 破壞性指令護欄 |
| `/checkpoint` | 跨 session 進度存取 |

## tp-* Skill（行程資料操作，不走 pipeline）

`/tp-request` `/tp-create` `/tp-edit` `/tp-check` `/tp-rebuild` `/tp-patch`

**判斷原則：改 code → 走七階段 pipeline；改行程資料 → 直接操作。**
