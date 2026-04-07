---
name: tp-team
description: Use when starting any code change, feature, bug fix, or refactoring in the trip-planner project. Not for trip data changes — those use tp-* data skills directly.
user-invocable: true
---

# tp-team — gstack Sprint Pipeline

**Claude 直接做事，invoke 不同 gstack skill 換帽子。** code 變更前 invoke 本 skill，確認完整 pipeline。

## 設計哲學

**遵循 gstack 官方七階段流程。** 每個階段是一個 gstack skill，前一階段的輸出自動成為下一階段的 context。不自創路由，不跳階段。

`/tp-code-verify` 是本專案加在 Review 的品質 gate，其餘全走 gstack 標準流程。

## 七階段 Pipeline

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

### 1. Think — 探索需求

| skill | 做什麼 | 何時用 |
|-------|--------|--------|
| `/office-hours` | YC Office Hours — 需求探索，產出 design doc | 新功能、架構變更、不確定方向 |
| `/design-consultation` | 建立設計系統（產出 DESIGN.md） | 需要定義視覺風格/品牌 |

**什麼時候跳：** 明確的 bug fix、config 調整、已知範圍的修改。

### 2. Plan — 方案審查

| skill | 做什麼 | 何時用 |
|-------|--------|--------|
| `/autoplan` | 一鍵跑 CEO + Design + Eng 三審，自動決策 | **建議預設使用** — 跨模組、架構選擇、多方案 |
| `/plan-ceo-review` | CEO 視角 — scope expansion / hold / reduction | 單獨跑 CEO 審查（非 autoplan） |
| `/plan-eng-review` | Eng 視角 — 架構、data flow、edge cases、test plan | 單獨跑工程審查 |
| `/plan-design-review` | Design 視角 — UI/UX 維度評分 0-10 | UI 變更時 |
| `/plan-devex-review` | DX 視角 — 開發者體驗審查 | API/CLI/SDK 變更時 |
| `/design-shotgun` | 多個設計方案比較（AI mockup variants） | 方向不確定時 |
| `/design-html` | 設計稿轉 production HTML/CSS | 有 approved mockup 時 |

**什麼時候跳：** 單一檔案修復、已有明確 plan 的任務。

### 3. Build — 實作

| skill | 做什麼 | 何時用 |
|-------|--------|--------|
| 寫 code | feature branch + TDD 開發 | **不可跳過** |
| `/simplify` | 3 agent 平行審查（reuse / quality / efficiency） | **不可跳過** — Build 完必跑 |
| `/codex` | OpenAI Codex 獨立審查 / adversarial challenge | 需要 cross-model 意見時 |

```bash
git checkout -b feat/描述  # 或 fix/描述
```

**Build 順序指引（多元件變更時）：**
1. Migration → 2. API handler → 3. Frontend → 4. Scripts/infra

### 4. Review — 程式碼審查

| skill | 做什麼 | 可跳過？ |
|-------|--------|---------|
| `/tp-code-verify` | tsc + tests + 命名規範 + CSS HIG + React Best Practices | **不可跳過** |
| `/review` | Staff engineer diff 審查 — SQL safety, race conditions, specialist dispatch, adversarial | **不可跳過** |
| `/design-review` | 視覺稽核 + CSS 修復（atomic commits + before/after 截圖） | UI 變更時 |

**失敗處理：**
1. 本 branch 引入 → 修復後重跑，直到全過（上限 3 次）
2. Pre-existing → 記錄在 PR body，不阻擋

### 5. Test — 測試 & 安全

| skill | 做什麼 | 可跳過？ |
|-------|--------|---------|
| `/cso --diff` | diff-scoped 安全掃描（secrets / injection / OWASP / STRIDE） | **不可跳過** |
| `/qa` | 瀏覽器 QA 測試 + bug fix with atomic commits | UI 變更時 |
| `/qa-only` | 純報告不修改，輕量驗證 | 非 owner review 時 |
| `/benchmark` | Core Web Vitals baseline comparison | UI 效能變更時 |
| `/browse` | 手動瀏覽器測試、截圖取證 | 需要視覺確認時 |
| `/devex-review` | 實際測試 DX — 跑 getting started、計時 TTHW | API/SDK/docs 變更時 |

### 6. Ship — 發布 & 部署

| skill | 做什麼 | 可跳過？ |
|-------|--------|---------|
| `/ship` | feature branch + PR + VERSION + CHANGELOG + coverage audit + adversarial review | **不可跳過** |
| `/document-release` | docs 同步（`/ship` Step 8.5 自動觸發） | 自動 |
| `/land-and-deploy` | merge PR + 等 CI + 部署驗證 | **不可跳過** |
| `/canary` | 部署後監控 console errors + performance | migration / 新 endpoint 建議跑 |
| `/setup-deploy` | 首次配置部署設定（一次性） | 首次 `/land-and-deploy` 前 |

### 7. Reflect — 回顧

| skill | 做什麼 | 何時用 |
|-------|--------|--------|
| `/retro` | 週回顧 — commit patterns + test health + shipping velocity | weekly 或手動 |
| `/health` | code quality dashboard — tsc + lint + tests + dead code | 需要時 |
| `/learn` | 管理跨 session 學習記錄 | 查看/修剪/匯出 learnings |

## 按需 skill（不綁定階段，需要時 invoke）

| skill | 何時用 |
|-------|--------|
| `/investigate` | bug 調查（自動 /freeze 限制範圍） |
| `/checkpoint` | 跨 session 進度存取 |
| `/careful` | 破壞性指令警告（rm -rf, DROP TABLE, force-push） |
| `/freeze` / `/unfreeze` | 限制/解除編輯範圍 |
| `/guard` | /careful + /freeze 最大安全模式 |
| `/setup-browser-cookies` | 匯入真實瀏覽器 cookie |
| `/open-gstack-browser` | 開啟 AI 控制的 Chromium（可視化） |
| `/gstack-upgrade` | 升級 gstack 到最新版 |

## Pipeline Commitment Gate

invoke 本 skill 後，輸出完整七階段確認：

```
✅ Think   — /office-hours（新功能/架構跑，bug fix 跳過）
✅ Plan    — /autoplan（多方案/跨模組跑，trivial 跳過）
✅ Build   — feature branch + 寫 code（TDD）+ /simplify
✅ Review  — /tp-code-verify + /review ← 不可跳過
✅ Test    — /cso --diff ← 不可跳過 | /qa（UI 變更）| /benchmark（效能變更）
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

## tp-* Skill（行程資料操作，不走 pipeline）

`/tp-request` `/tp-create` `/tp-edit` `/tp-check` `/tp-rebuild` `/tp-patch`

**判斷原則：改 code → 走七階段 pipeline；改行程資料 → 直接操作。**
