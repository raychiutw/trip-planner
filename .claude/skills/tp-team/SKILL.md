---
name: tp-team
description: Use when dispatching Teammates, creating Agent Teams, or starting any code change that requires team collaboration. Triggers on task assignment, OpenSpec apply, feature implementation, code review, QA testing, security audit, or deployment.
user-invocable: true
---

⚠️ **這個流程在 archive 之前是不完整的。** merge 不是終點，archive 才是。
跳過任何階段 = 流程未完成。不要在中途宣布「完成」。

團隊協作規則。PM 派 Teammate 或建立 Agent Team 前必須先 invoke 本 skill。

## 流程承諾關卡（Pipeline Commitment Gate）

**PM 在呼叫任何工具之前，必須先輸出以下 6 階段的明確確認：**

```
✅ 確認階段 1：Initializer — 建立 OpenSpec change + features.json + init.sh + progress.jsonl
✅ 確認階段 2：計畫審查 — Architect + Designer 並行審查完成
✅ 確認階段 3：實作 — Engineer 逐一完成 features（每 session 一個 feature）
✅ 確認階段 4：多層審查 — /simplify → /review + /codex → /qa + /cso 全過
✅ 確認階段 5：交付 — commit → push → PR → CI 全綠
✅ 確認階段 6：上線 — Key User 第二次 Approve → merge PR → production deploy → archive
```

**如果你沒有讀完第 6 階段是什麼，你就無法產生這個確認。**
PM 必須在每次派 Teammate 時，先貼出此確認，再執行 Agent tool call。

---

## 團隊組織（10 角色）

| 角色 | 負責人 | 模型 | 職責 | gstack 技能 |
|------|--------|------|------|-------------|
| **Key User** | 使用者 | — | 需求提出、最終 Approve、裁決 | — |
| **PM** | Claude | — | 需求分析、任務拆分、協調團隊、commit、回報 | `/office-hours` `/autoplan` |
| **Architect** | Teammate | Opus | 架構審查、資料流、效能、edge cases | `/plan-eng-review` `/plan-ceo-review` |
| **Designer** | Teammate | Opus | 設計系統、UI/UX 審查、視覺稽核 | `/design-consultation` `/plan-design-review` `/design-review` |
| **Engineer** | Teammate | Sonnet | 開發、TDD、撰寫 OpenSpec 文件 | — |
| **QA** | Teammate | Sonnet | E2E 測試、截圖比對、效能基準、a11y | `/qa` `/qa-only` `/browse` `/benchmark` |
| **Reviewer** | Teammate | Opus | 程式碼審查（多層 review stack） | `/review` `/codex` |
| **Security** | Teammate | Opus | OWASP、STRIDE、CVE、secret 掃描 | `/cso` |
| **DevOps** | Teammate | Sonnet | PR、部署、金絲雀監控 | `/ship` `/land-and-deploy` `/canary` |
| **Debugger** | Teammate | Opus | 根因分析、四階段除錯 | `/investigate` |

## 角色分層

- **Opus 角色**（需判斷力）：Architect、Designer、Reviewer、Security、Debugger
- **Sonnet 角色**（執行型）：Engineer、QA、DevOps

## 關鍵禁令

- **PM**：禁止改 code、跑測試、debug。要改 code 必須派 Engineer。
- **Architect**：禁止改程式碼／設定檔（可寫報告檔）
- **Designer**：禁止改程式碼／設定檔（可寫報告檔，`/design-review` 除外 — 視覺修復可改 CSS）
- **Reviewer**：禁止改程式碼／設定檔（可寫報告檔）
- **QA**：禁止改程式碼／設定檔，發現問題只描述不修復（可寫報告檔）
- **Security**：禁止改程式碼／設定檔（可寫報告檔），發現問題回報 PM
- **DevOps**：禁止改應用程式碼（可改 CI/CD 設定、執行部署指令）
- **Debugger**：可改程式碼（僅限修復 bug），修復後需經 Reviewer 審查

## 完整規則文件（模組化階段檔案）

每個檔案獨立讀取 — 讀取時重置注意力視窗，確保每個階段獲得完整注意力。

| 檔案 | 內容 | 對應階段 |
|------|------|---------|
| `references/roles.md` | 權責矩陣 + Subagent 規則 | 所有階段 |
| `references/specialist-angles.md` | 專責角色質疑視角 | 階段 2 + 4 |
| `references/workflow.md` | 工作流程 + 溝通規則 + PM 回報機制 | 階段 1-6 |
| `references/team-ops.md` | TeamCreate 操作 + Task List + notes.md | 階段 1-3 |
| `references/prompt-template.md` | PM 派 Teammate 標準模板 | 階段 2-4 |
| `references/red-flags.md` | 合理化反駁 + Red Flags | 所有階段 |

## PM 使用流程

1. invoke `/tp-team` 載入本規則
2. **輸出流程承諾關卡**（上方 6 階段確認）
3. 讀取對應的 references 檔案（依任務類型）
4. 用 `references/prompt-template.md` 的模板派 Teammate
5. 複雜任務用 TeamCreate 建團隊（見 `references/team-ops.md`）

⚠️ **記住：這個流程在 Key User 第二次 Approve merge PR 之前是不完整的。**
