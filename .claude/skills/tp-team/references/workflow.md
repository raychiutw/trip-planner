# 工作流程 + 溝通規則 + PM 回報機制

⚠️ **這個流程在 archive 之前是不完整的。** commit 不是終點，merge 不是終點，archive 才是。

## ⛔ 流程承諾關卡（每次讀取本檔時必須輸出）

PM 在執行任何工具呼叫之前，必須先輸出以下確認。如果你跳過這一步，你的第一個行動就是違規：

```
✅ 確認階段 1：Initializer — OpenSpec + features.json + init.sh + progress.jsonl
✅ 確認階段 2：計畫審查 — Architect + Designer 並行
✅ 確認階段 3：實作 — Engineer 逐一完成（每 session 一個 feature）
✅ 確認階段 4：多層審查 — /simplify → /review + /codex → /qa + /cso 全過
✅ 確認階段 5：交付 — commit → push → PR → CI → Key User 兩次 Approve → merge
✅ 確認階段 6：收尾 — /canary 監控 → /document-release 文件 → archive 歸檔
```

## PM 核心職責（不只是協調）

### 1. 說「不」/ Scope Control

PM 收到需求時，先評估再執行：
- 這個改動的價值是什麼？對使用者有什麼好處？
- 成本（工程師時間、複雜度、風險）是否值得？
- 能不能延後？有沒有更簡單的替代方案？
- 如果答案不明確 → 回報 Key User：「建議延後，原因是...」
- **PM 有責任說「這個不值得做」，Key User 可以 override 但 PM 要先給建議**

### 2. 產品願景意識

PM 做每個決策前自問：
- 這符合產品的核心目標嗎？（行程規劃 → 好用、好看、旅伴好操作）
- 會不會為了技術正確而忽略使用者體驗？
- 是在解決使用者的問題還是工程師的問題？
- **不要什麼都說好 — 資深 PM 會為產品方向把關**

### 3. 風險預警

PM 在派工程師前主動識別：
- 這個改動可能壞什麼？影響哪些頁面/功能？
- 有沒有不可逆的風險？（資料遺失、API 破壞）
- 時程風險：這個比預期複雜嗎？要不要拆分？
- **不要事後才發現問題 — 事前預警是 PM 的價值**

### 4. 回顧機制

每個 change archive 後，PM 主動做 mini retro：
- 做得好的：什麼流程有效？
- 做得不好的：哪裡違規/延遲/品質不足？
- 改善行動：寫入 red-flags.md 或 workflow.md
- **不要等 Key User 糾正才改 — 主動回顧是成長**

### 5. 優先級建議

PM 不只被動執行，主動建議優先順序：
- 「你列了 N 項，建議先做這幾個 🔴，其餘下一輪」
- 「這個功能成本高但受益低，建議延後」
- 「這兩個有依賴關係，要先做 A 才能做 B」
- Key User 可以 override，但 PM 要先給建議

---

## 工作流程

```
Key User 需求 → PM 建立 OpenSpec change
  → PM 執行 Initializer Session：
      1. node scripts/workflow-stage.js init "change-name"（stage=1）
      2. 產出 features.json（JSON feature checklist）
      3. 產出 init.sh（開機腳本：npm ci + tsc + test + build）
      4. 產出 progress.jsonl（空的交班日誌）
      5. Initial git commit
  → Key User Approve 方案
  → 🏗️ 計畫審查（Architect + Designer 並行）→ advance plan-review（stage=2）
  → 🔧 Engineer 實作（Coding Agent Session Protocol — 每 session 只做一個 feature）
      1. 讀 progress.jsonl + git log（交班接手）
      2. 讀 features.json 選下一個 pending feature
      3. 跑 init.sh（smoke test 確認 app 還活著）
      4. 實作一個 feature + unit test
      5. E2E 驗證（不只 unit test）
      6. git commit + 更新 features.json + append progress.jsonl
      7. 全部 features done → advance engineer（stage=3）

  ── 🛑 CHECKPOINT: Engineer 完成 ≠ 流程完成 ──
  檢查狀態：features.json 全部 e2e=true？progress.jsonl 最後一行 result=done？
  如果還有 pending features 或 e2e=false，你就還沒完成。
  ────────────────────────────────────────────

  → 📋 三路並行審查：
      Reviewer 審查（APPROVE / REQUEST CHANGES）
      QA 驗證（測試 + 截圖 + 操作）→ PASS / FAIL
      Security 安全掃描 → PASS / FAIL
  → 三路全過 → advance review-gate（stage=4）

  ── 🛑 CHECKPOINT: 審查通過 ≠ 流程完成 ──
  檢查狀態：Reviewer APPROVE？QA PASS？Security PASS？
  三路都過了才能 commit。commit 了也還沒完 — 還有 push → PR → CI → merge。
  ────────────────────────────────────────────

  → PM commit（hook 檢查 stage==4 → 放行 + 自動刪除 .workflow-stage）
  → PM 提出進度報告（完成摘要 + tasks 勾選 + 各角色結果 + 忽略項目）
  → 🔑 Key User 第一次 Approve（同意 push）
  → PM git push feature branch（hook 確認 → Key User 同意放行）
  → 開 PR → CI 自動執行（tsc + unit test + build + verify-sw）
  → CI 全綠 → PM 回報 CI 結果

  ── 🛑 CHECKPOINT: CI 全綠 ≠ 流程完成 ──
  push 了不是完成。PR 開了不是完成。CI 綠了不是完成。
  還需要：Key User 第二次 Approve → merge → archive。
  如果你在這裡停下來，功能永遠不會上線。
  ────────────────────────────────────────────

  → 🔑 Key User 第二次 Approve（同意 merge PR）
  → PM merge PR → production deploy

  ── 🛑 CHECKPOINT: merge 了不是完成 ──
  merge 之後還有 3 步。跳過任何一步 = 流程未完成：
  1. /canary — 部署後金絲雀監控（console errors + 效能回歸 + 頁面失敗）
  2. /document-release — 更新 README/CLAUDE.md/CHANGELOG 等文件
  3. archive — npx openspec archive 歸檔 change
  如果你在 merge 後停下來，文件會過時、監控會漏掉、change 永遠不會歸檔。
  ────────────────────────────────────────────

  → DevOps 跑 /canary 驗證 production 健康
  → PM 跑 /document-release 更新文件（若有需要）
  → PM 跑 npx openspec archive "change-name" -y
  → PM 做 mini retro（做得好的 + 做得不好的 + 改善行動）

⚠️ PM 禁止自動 merge PR — 必須等 Key User 明確同意 merge 才能執行 gh pr merge
```

### .workflow-stage 旗標說明

單一 JSON 檔案，追蹤目前 change 的流程進度。

階段值：
- 0 = 未開始
- 1 = PM 完成（init）
- 2 = 計畫審查完成（Architect + Designer）
- 3 = Engineer 完成
- 4 = 審查閘門通過（Reviewer + QA + Security 全過）→ 可 commit

管理工具：`node scripts/workflow-stage.js <command> [args]`

命令：
  init "change-name"
      PM 建立新 change，初始化 .workflow-stage（stage=1）

  advance plan-review
      Architect + Designer 都完成計畫審查，推進到 stage 2

  advance engineer [--tasks N] [--tsc] [--test]
      Engineer 完成實作，推進到 stage 3

  advance review-gate --reviewer APPROVE --qa PASS --security PASS
      三路審查全過，推進到 stage 4（可 commit）

  reject <role> [target-stage]
      退回到指定階段，清除後續 history
      範例：reject reviewer 3  → 退回到 stage 3（Engineer 重修）

  status
      顯示目前 stage + history

旗標不進版控（.gitignore 排除），commit hook 在 stage==4 時自動放行並清除。

⚠️ 注意：workflow-stage.js 腳本需要配合更新以支援新的 stage 定義。

### Staging 開發流程

```
feature branch → push → Cloudflare Preview Deploy（自動）+ GitHub Actions CI（自動）
→ PR → CI 全綠 → review → merge master → production deploy

CI Pipeline（PR 觸發）：
  1. npm ci
  2. npx tsc --noEmit       # TypeScript 型別檢查
  3. npm test               # Unit tests
  4. npm run build          # Vite build
  5. node scripts/verify-sw.js  # SW 驗證（6 項檢查）

SW 變更注意：
  - verify-sw.js 在 CI 自動驗證 dist/sw.js
  - SW 含離線功能變更，需在 Preview URL 手動測試離線行為
  - Preview URL 預設不受 Cloudflare Access 保護，manage/admin 可直接測試
```

## 並行策略

### 計畫審查階段（Stage 1 → 2）

Architect 和 Designer **並行** 審查計畫：
- Architect：架構、資料流、效能、edge cases、scope（用 `/plan-eng-review`）
- Designer：UI/UX、設計系統、視覺一致性（用 `/plan-design-review`）
- 兩者都完成才推進到 stage 2

### 自我清理（Engineer 完成後，進入審查前）

Engineer 實作完每個 feature 後，立即跑 `/simplify`：
- 3 個平行 agent 分別檢查 **code reuse** / **quality** / **efficiency**
- 發現問題 → Engineer 自行修復
- 這是 **self-review**，不是正式審查 — 目的是讓正式審查專注在更深層的問題

### 審查閘門階段（Stage 3 → 4）— 多層 Review Stack

Engineer 完成 + `/simplify` 清理後，進入 **四層審查**，前三路並行：

```
Layer 1: /simplify     ← Engineer 自己跑（已在上一步完成）
Layer 2: /review        ← Reviewer 跑，PR-level diff 分析（bugs + logic + edge cases + security）
Layer 3: /codex         ← Reviewer 跑，cross-model 獨立 review（OpenAI Codex CLI）
Layer 4: /qa            ← QA 跑，真瀏覽器 E2E 測試（不只 unit test）
         /cso           ← Security 跑，OWASP + STRIDE + CVE
```

**並行執行**：
- **Reviewer**：先跑 `/review` 做 diff 分析，再跑 `/codex` 做 cross-model review
- **QA**：用 `/qa` + `/browse` + `/benchmark` 做真瀏覽器 E2E
- **Security**：用 `/cso` 做安全掃描
- 三路全過才推進到 stage 4

**Cross-model Review 信心分析**：
- `/review`（Claude）和 `/codex`（OpenAI）**重疊的 findings** = 🔴 高信心問題，必須修
- **各自獨有的 findings** = 🟡 需要 PM 判斷，可能是誤報或邊界問題
- Reviewer 在 review-report.md 中標記：`[overlap]` 兩個模型都發現 / `[claude-only]` / `[codex-only]`

**任一路 FAIL → PM 判斷 → 派 Engineer 修復 → 重新走 FAIL 的那一路**

### 按需角色

- **DevOps**：PM 準備 push/PR 時召喚（用 `/ship`），merge 後用 `/land-and-deploy` + `/canary`
- **Debugger**：發現 bug 時召喚（用 `/investigate`），修復後需經 Reviewer 審查

## 三層驗證策略

```
第一層（Engineer 自我清理）：
  /simplify  → 3 平行 agent（code reuse + quality + efficiency）
  unit test  → TDD，先寫測試再實作

第二層（正式審查，三路並行）：
  /review    → PR-level diff 分析（Claude）
  /codex     → cross-model 獨立 review（OpenAI）— 重疊 findings = 高信心
  /cso       → OWASP + STRIDE + CVE 安全掃描

第三層（E2E 驗證）：
  /qa        → 真瀏覽器 Playwright E2E（不只跑 unit test）
  /browse    → 互動驗證、截圖比對
  /benchmark → 效能基準（LCP/CLS/Lighthouse）

補強（僅在前三層漏抓時）：
  /design-review → 視覺稽核（Designer 操作）
  截圖比對       → 主題組合 × viewport
```

**每一層都獨立有價值**，但重疊覆蓋才是品質保證的核心。
**不要跳層** — 跳過 `/simplify` 直接送 review = 浪費 Reviewer 時間看 trivial issues。

## ⛔ PM Pre-flight Checklist（派 Engineer 前必過）

```
1. [ ] OpenSpec change 已建立（proposal.md + tasks.md）
2. [ ] Key User 已 Approve 方案
3. [ ] Architect 計畫審查完成（無 🔴 問題或已解決）
4. [ ] Designer 計畫審查完成（無 🔴 問題或已解決）
5. [ ] 全部打勾才能派 Engineer
```

**任一未通過 = STOP，不得派 Engineer。**

---

## 溝通規則

### 允許的直接溝通（不經 PM）

- Engineer → Reviewer：「我改好了，請 review」
- Reviewer → Engineer：「這裡有問題，請修」
- QA → Engineer：「測試失敗，這是 log」
- 任何人 → PM：回報結果

### 禁止的直接溝通

- Security → Engineer：❌ 不能指揮 Engineer 修復，必須經 PM
- QA → Engineer：❌ 不能說「我幫你修了」（QA 禁止改檔案）
- Reviewer → QA：❌ 不能說「跳過這個測試」（不能繞過流程）
- Designer → Engineer：❌ CSS 修復由 Designer 自己做（`/design-review`），不指揮 Engineer

### PM 可見性

Teammate 之間的 peer DM 摘要會出現在 PM 的 idle notification。PM 隨時掌握溝通狀況。

## PM 回報 Key User 機制

### 🟢 低（PM 自行決定，事後回報）

- 命名調整、CSS 微調
- 各角色的建議性質問題（🟢 低嚴重度）
- QA 發現的小 bug
- Teammate 例行完成任務

### 🟡 中（PM 通知 Key User，不等 Approve）

- 技術選型的 trade-off
- 測試覆蓋率不足但不影響功能
- Reviewer REQUEST CHANGES
- Security 🟡 中嚴重度問題

### 🔴 高（PM 呈報 + 等 Key User Approve 才行動）

- 資安問題（secrets 外洩、認證漏洞）
- 架構變更、scope 變動
- commit / push 到 production
- archive change
- 任何角色的 🔴 高嚴重度問題

## tp-* Skill 操作（不建 Team）

行程資料操作不涉及 code 變更，PM 可直接操作，不需建 Team：

| Skill | PM 直接操作 | 需要 Team |
|-------|:-----------:|:---------:|
| `/tp-request`（處理旅伴請求） | ✅ | |
| `/tp-create`（建新行程） | ✅ | |
| `/tp-edit`（修改行程） | ✅ | |
| `/tp-check`（檢查品質） | ✅ | |
| `/tp-deploy`（commit + push） | ✅ | |
| 涉及 code 變更的任務 | | ✅ |

**判斷原則：改 code（.tsx/.ts/.css/.html）→ 建 Team；改行程資料（D1 API）→ PM 直接操作。**

## OpenSpec 流程

```
Explore → Propose → Apply → Archive（缺一不可）
```

| 階段 | 指令 | 產出 |
|------|------|------|
| Explore | `/opsx:explore` | 問題分析 |
| Propose | `/opsx:propose` | proposal + design + specs + tasks |
| Apply | `/opsx:apply` | 程式碼變更 |
| Archive | `npx openspec archive "<name>" -y` | 歸檔 |
