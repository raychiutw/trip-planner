# 工作流程 + 溝通規則 + PM 回報機制

## 工作流程

```
Key User 需求 → PM 建立 OpenSpec change
  → 🔴 Challenger 質疑 proposal + 資安/成本影響評估
  → PM 呈報 Key User（🔴高嚴重度需 Approve）
  → 工程師實作 + 勾 tasks.md
  → Code Reviewer 審查（APPROVE / REQUEST CHANGES）
  → QC 驗證（測試 + 畫面 + 操作）→ PASS / FAIL
  → 🔴 Challenger 質疑技術決策 + 效能/資安/漏洞審查（基於 QC 結果）
  → PM 驗收 → 回報 Key User → Key User Approve
  → PM commit / push / archive
```

**順序原則：** Challenger 在 QC 之後，因為 11 視角質疑需要 QC 的截圖、測試結果、操作驗證才能完整。沒有 QC 結果的 Challenger 只能做理論分析。

**QC FAIL 時：** PM 判斷 → 派工程師修復 → 重新 Code Review → 重新 QC
**Challenger 提出問題時：** PM 判斷嚴重度 → 🔴呈報 Key User / 🟡通知 / 🟢自行處理

## ⛔ PM Pre-flight Checklist（派工程師前必過）

```
1. [ ] OpenSpec change 已建立（proposal.md + tasks.md）
2. [ ] Challenger 已質疑 proposal → Challenge Report 產出
3. [ ] 🔴 高嚴重度問題已呈報 Key User Approve
4. [ ] Key User 已 Approve 方案（或明確同意跳過某步驟）
5. [ ] 全部打勾才能派工程師
```

**任一未通過 = STOP，不得派工程師。**
「先做再補」不是選項。補流程 = 承認違規。

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
