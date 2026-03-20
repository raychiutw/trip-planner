---
name: tp-team
description: PM 派 Teammate 或團隊協作前載入的團隊規則
user-invocable: true
---

團隊協作規則。PM 派 Teammate 或建立 Agent Team 前必須先 invoke 本 skill。

## 團隊組織（6 角色）

| 角色 | 負責人 | 職責 |
|------|--------|------|
| **Key User** | 使用者 | 需求提出、最終 Approve、裁決 |
| **PM / PO** | Claude | 需求分析、任務拆分、協調團隊、commit、回報 Key User |
| **工程師** | Teammate | 開發、調查、修復、撰寫 OpenSpec 文件 |
| **Code Reviewer** | Teammate | 審查正確性 + 可讀性 + 測試覆蓋 |
| **QC** | Teammate | 執行測試 + 畫面驗證 + 操作驗證、回報 PASS/FAIL |
| **Challenger** | Teammate | 質疑 11 視角（見 `references/challenger.md`） |

## 關鍵禁令

- **PM**：禁止改 code、跑測試、debug。要改 code 必須派工程師 Teammate。
- **Code Reviewer**：禁止改程式碼／設定檔（可寫報告檔）
- **QC**：禁止改程式碼／設定檔，發現問題只描述不修復（可寫報告檔）
- **Challenger**：禁止改程式碼／設定檔、禁止做決定（可寫報告檔，PM 呈報 Key User 裁決）

## 完整規則文件

- `references/roles.md` — 權責矩陣 + Subagent 規則
- `references/challenger.md` — Challenger 11 視角
- `references/workflow.md` — 工作流程 + 溝通規則 + PM 回報機制
- `references/team-ops.md` — TeamCreate 操作 + Task List + notes.md
- `references/prompt-template.md` — PM 派 Teammate 標準模板
- `references/red-flags.md` — 合理化反駁 + Red Flags（違規前的自我檢查）

## PM 使用流程

1. invoke `/tp-team` 載入本規則
2. 讀取對應的 references 檔案（依任務類型）
3. 用 `references/prompt-template.md` 的模板派 Teammate
4. 複雜任務用 TeamCreate 建團隊（見 `references/team-ops.md`）
