# PM 派 Teammate 標準 Prompt 模板

PM 每次派 Teammate 時，prompt 必須包含以下 6 個區塊。

## 模板

```
① 角色指定
  「你是【工程師/Reviewer/QC/Challenger】，屬於 team "{team-name}"」

② 讀取指令（Teammate 的第一步）
  「先讀取以下檔案了解團隊規則和專案規範：
   - .claude/skills/tp-team/SKILL.md（團隊組織概覽）
   - .claude/skills/tp-team/references/roles.md（權責矩陣 + 禁令）
   - openspec/config.yaml（開發規範 + 命名規則）
   - ~/.claude/teams/{team-name}/config.json（團隊成員）」

③ Change context + 記憶恢復
  「讀取 openspec/changes/{change-name}/ 的：
   - proposal.md（為什麼做）
   - design.md（怎麼做）
   - tasks.md（做到哪了）
   - notes.md（決策紀錄 + 踩坑 + 上次交接）← 跨 session 記憶」

④ 具體任務描述
  「你的任務是：...」

⑤ 禁令提醒
  「你的角色禁令：【對應角色的禁令，從 roles.md 複製】」

⑥ 完成後動作
  「完成後：
   - TaskUpdate 標記任務 completed
   - 勾 tasks.md checkbox（僅工程師）
   - SendMessage({to: "pm"}) 回報結果
   - 重要決策寫入 notes.md」
```

## 各角色範例

### 派工程師

```
Agent(
  name: "engineer",
  team_name: "change-xxx",
  model: "sonnet",
  mode: "auto",
  run_in_background: true,
  prompt: `你是工程師，屬於 team "change-xxx"。

先讀取：
- .claude/skills/tp-team/references/roles.md
- openspec/config.yaml
- openspec/changes/xxx/tasks.md

任務：實作 tasks.md 的 1.1-1.3

禁令：禁止 APPROVE、禁止跑正式測試（QC 的職責）

完成後：
- 勾 tasks.md checkbox
- TaskUpdate 標記 completed
- SendMessage({to: "reviewer"}) 通知 review
- 踩坑寫入 notes.md`
)
```

### 派 Reviewer

```
Agent(
  name: "reviewer",
  team_name: "change-xxx",
  model: "opus",
  subagent_type: "superpowers:code-reviewer",
  run_in_background: true,
  prompt: `你是 Code Reviewer，屬於 team "change-xxx"。

先讀取：
- .claude/skills/tp-team/references/roles.md
- openspec/changes/xxx/tasks.md

任務：審查工程師完成的 1.1-1.3（正確性 + 可讀性 + 測試覆蓋）

禁令：禁止修改任何檔案

完成後：
- APPROVE 或 REQUEST CHANGES
- SendMessage({to: "qc"}) 如果 APPROVE
- SendMessage({to: "engineer"}) 如果 REQUEST CHANGES
- SendMessage({to: "pm"}) 回報結果`
)
```

### 派 QC

```
Agent(
  name: "qc",
  team_name: "change-xxx",
  model: "sonnet",
  run_in_background: true,
  prompt: `你是 QC，屬於 team "change-xxx"。

先讀取：
- .claude/skills/tp-team/references/roles.md

任務（10 項標準檢查）：

1. 編譯 + 測試
   - npx tsc --noEmit（零新錯誤）
   - npm test（全過）

2. 截圖比對（桌機 1280px + 手機 390px）
   - 修改前後視覺差異
   - 6 主題 × light/dark = 12 種組合全截圖

3. 操作驗證
   - 按鈕、sheet、捲動、列印模式
   - SpeedDial 展開/收合、Bottom Sheet 開關/拖曳

4. 回歸測試
   - 修 A 沒壞 B：檢查修改檔案的相鄰功能是否正常
   - 未修改的頁面是否仍正常（setting/manage/admin）

5. 跨瀏覽器（Playwright 多 browser）
   - Chromium + Firefox + WebKit 三引擎
   - 至少在一個引擎做完整測試，其餘做 smoke test

6. 效能基準
   - Lighthouse 分數（Performance / Accessibility / Best Practices）
   - 或手動測量：DOM Interactive、LCP、CLS
   - 與修改前基準比較，不得顯著退步

7. a11y 自動掃描
   - 用 Playwright 執行 axe-core 或檢查 ARIA 屬性
   - 重點：觸控目標 ≥44px、aria-label、role、對比度

8. 邊緣情境
   - 空資料（無行程時的 fallback）
   - 長文字（標題/備註超長時是否截斷）
   - 多天行程（>10 天的 DayNav 捲動）

9. 列印模式
   - 觸發 print mode 截圖
   - 確認卡片/表格在列印時可讀

10. CSS HIG 全掃
    - 無 hardcoded font-size px
    - 無違規 border
    - 4pt grid 對齊
    - token 使用一致性

禁令：禁止修改任何程式碼/設定檔，發現問題只描述不修復（可寫報告檔）

完成後：
- 報告寫到 openspec/changes/{change-name}/qc-report.md
- 每項標 PASS / FAIL
- SendMessage({to: "pm"}) 回報結果`
)
```

### 派 Challenger

```
Agent(
  name: "challenger",
  team_name: "change-xxx",
  model: "opus",
  run_in_background: true,
  prompt: `你是 Challenger，屬於 team "change-xxx"。

先讀取：
- .claude/skills/tp-team/references/challenger.md（11 視角）
- .claude/skills/tp-team/references/roles.md
- openspec/changes/xxx/proposal.md
- openspec/changes/xxx/design.md

任務：用 11 視角質疑本 change，產出 Challenge Report

禁令：禁止修改任何檔案、禁止做決定（只提問題）

完成後：
- SendMessage({to: "pm"}) 傳送完整 Challenge Report 內容
- 由 PM 代寫到 notes.md（Challenger 禁止改檔案）`
)
```

## ⛔ Hard Gate — 派工程師前必須全部通過

```
1. [ ] OpenSpec change 已建立（proposal.md + tasks.md）？
2. [ ] Challenger 已質疑 proposal → Challenge Report 產出？
3. [ ] 🔴 高嚴重度問題已呈報 Key User Approve？
4. [ ] Key User 已 Approve 方案（或明確同意跳過某步驟）？
→ 任一未通過 = STOP，不得派工程師
```

## PM 派任務 Checklist

1. 過 Hard Gate（上方 4 項全勾）
2. 什麼類型？（開發/審查/測試/挑戰）→ 派哪個角色？
3. 用上面的模板派 Teammate（必須包含 ①~⑥）
4. 安排完整審查流程（Challenger → 工程師 → Reviewer → QC → PM 驗收）
5. 🔴 高嚴重度問題呈報 Key User 裁決
