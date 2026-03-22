# 工作流程 + 溝通規則 + PM 回報機制

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
  → PM 執行 node scripts/workflow-stage.js init "change-name"（stage=1）
  → Key User Approve 方案
  → 工程師實作（feature branch）+ 勾 tasks.md + advance engineer（stage=2）
  → Code Reviewer 審查（APPROVE / REQUEST CHANGES）+ advance reviewer（stage=3）
  → QC 驗證（測試 + 截圖 + 操作）→ PASS / FAIL + advance qc（stage=4）
  → 🔴 Challenger 質疑（基於 QC 結果，11 視角全面質疑）→ PM advance challenger（stage=5）
  → PM commit（hook 檢查 stage==5 → 放行 + 自動刪除 .workflow-stage）
  → PM 提出進度報告（完成摘要 + tasks 勾選 + Reviewer/QC 結果 + 忽略項目）
  → 🔑 Key User 第一次 Approve（同意 push）
  → PM git push feature branch（hook 確認 → Key User 同意放行）
  → 開 PR → CI 自動執行（tsc + unit test + build + verify-sw）
  → CI 全綠 → PM 回報 CI 結果
  → 🔑 Key User 第二次 Approve（同意 merge PR）
  → PM merge PR → production deploy
  → archive

⚠️ PM 禁止自動 merge PR — 必須等 Key User 明確同意 merge 才能執行 gh pr merge
```

### .workflow-stage 旗標說明

 是單一 JSON 檔案，追蹤目前 change 的流程進度。



階段值：
- 0 = 未開始
- 1 = PM 完成（init）
- 2 = 工程師完成
- 3 = Reviewer 完成（APPROVE）
- 4 = QC 完成（PASS）
- 5 = Challenger 完成 → 可 commit

管理工具：用法：node scripts/workflow-stage.js <command> [args]

命令：
  init "change-name"
      PM 建立新 change，初始化 .workflow-stage（stage=1）

  advance engineer [--tasks N] [--tsc] [--test]
      工程師完成實作，推進到 stage 2

  advance reviewer --result APPROVE
      Reviewer 完成審查，推進到 stage 3

  advance qc --result PASS [--tests N]
      QC 完成驗證，推進到 stage 4

  advance challenger [--high N] [--medium N] [--low N]
      Challenger 完成質疑，推進到 stage 5（可 commit）

  reject <role> [target-stage]
      退回到指定階段，清除後續 history
      範例：reject reviewer 2  → 退回到 stage 2

  status
      顯示目前 stage + history

階段說明：
  0 = 未開始
  1 = PM 完成（init）
  2 = 工程師完成
  3 = Reviewer 完成（APPROVE）
  4 = QC 完成（PASS）
  5 = Challenger 完成 → 可 commit（詳見 help）

旗標不進版控（.gitignore 排除），commit hook 在 stage==5 時自動刪除。

### Staging 開發流程

```
現在（staging-ci-cd 後）：
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

**Challenger 只出現一次，在 QC 之後。** Proposal 階段不需要 Challenger。

## 兩階段驗證策略

```
第一階段（快速、自動化、可重複執行）：
  工程師 → unit test（TDD：先寫測試再實作）
  QC     → E2E test script（Playwright .spec.ts，可重複跑）
  Challenger → DOM/CSS 程式化分析（evaluate、querySelector）

第二階段（強化、視覺判斷）：
  QC     → 截圖比對（主題組合 × viewport）
  Challenger → 截圖 UX 質疑
```

**第一階段是主要驗證手段**，快速且可重複。正常流程只跑第一階段。
**第二階段只在被反應第一階段沒發現的問題時才使用** — 作為補強手段，不是每次都跑。
不要每次都截圖 — 截圖慢且不可重複，只在需要時使用。

**順序原則：** Challenger 在 QC 之後，因為 11 視角質疑需要 QC 的截圖、測試結果、操作驗證才能完整。沒有 QC 結果的 Challenger 只能做理論分析。

**QC FAIL 時：** PM 判斷 → 派工程師修復 → 重新 Code Review → 重新 QC
**Challenger 提出問題時：** PM 判斷嚴重度 → 🔴呈報 Key User / 🟡通知 / 🟢自行處理

## ⛔ PM Pre-flight Checklist（派工程師前必過）

```
1. [ ] OpenSpec change 已建立（proposal.md + tasks.md）
2. [ ] Key User 已 Approve 方案
3. [ ] 全部打勾才能派工程師
```

**Challenger 不在 Pre-flight 中** — Challenger 只在實作完成後（QC 之後）才質疑。
Proposal 階段由 Key User 直接 Approve，不需 Challenger 預審。

**任一未通過 = STOP，不得派工程師。**

---

## 溝通規則

### 允許的直接溝通（不經 PM）

- 工程師 → Reviewer：「我改好了，請 review」
- Reviewer → 工程師：「這裡有問題，請修」
- QC → 工程師：「測試失敗，這是 log」
- 任何人 → PM：回報結果

### 禁止的直接溝通

- Challenger → 工程師：❌ Challenger 不能指揮工程師，必須經 PM
- QC → 工程師：❌ 不能說「我幫你修了」（QC 禁止改檔案）
- Reviewer → QC：❌ 不能說「跳過這個測試」（不能繞過流程）

### PM 可見性

Teammate 之間的 peer DM 摘要會出現在 PM 的 idle notification。PM 隨時掌握溝通狀況。

## PM 回報 Key User 機制

### 🟢 低（PM 自行決定，事後回報）

- 命名調整、CSS 微調
- Challenger 的建議性質問題
- QC 發現的小 bug
- Teammate 例行完成任務

### 🟡 中（PM 通知 Key User，不等 Approve）

- 技術選型的 trade-off
- 測試覆蓋率不足但不影響功能
- Code Review REQUEST CHANGES

### 🔴 高（PM 呈報 + 等 Key User Approve 才行動）

- 資安問題（secrets 外洩、認證漏洞）
- 架構變更、scope 變動
- commit / push 到 production
- archive change
- Challenger 🔴 高嚴重度問題

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
