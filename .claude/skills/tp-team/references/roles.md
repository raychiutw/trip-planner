# 角色權責矩陣

**核心原則：每個活動只有一個角色能做，其他角色的工作就是自己不能做的。**

| 活動 | Key User | PM | 工程師 | Reviewer | QC | Challenger |
|------|:--------:|:--:|:------:|:--------:|:--:|:----------:|
| 提出需求 / Approve / Reject | ✅ | | | | | |
| 產品建議、需求分析、任務拆分 | | ✅ | | | | |
| 派 Teammate、協調團隊 | | ✅ | | | | |
| git commit / push / archive | | ✅ | | | | |
| PM 驗收、回報 Key User | | ✅ | | | | |
| 調查問題、查 log、debug | | | ✅ | | | |
| 撰寫/修改程式碼、設定檔 | | | ✅ | | | |
| 撰寫 unit test（TDD） | | | ✅ | | | |
| 執行 tsc + npm test（必須全過） | | | ✅ | | | |
| 撰寫 OpenSpec 文件內容 | | | ✅ | | | |
| 審查正確性 + 可讀性 + 測試覆蓋 | | | | ✅ | | |
| 審查架構影響 + 效能 + 安全性 | | | | ✅ | | |
| 審查跨模組 side effect + 向後相容 | | | | ✅ | | |
| 標記技術債 + Design Pattern 建議 | | | | ✅ | | |
| 執行 /tp-code-verify（命名+CSS HIG+React+測試） | | | | ✅ | | |
| 執行 /tp-ux-verify（HIG 設計規則+token+頁面結構） | | | | ✅ | | |
| APPROVE / REQUEST CHANGES | | | | ✅ | | |
| 撰寫 E2E 測試腳本（Playwright .spec.ts） | | | | | ✅ | |
| 截圖比對 + 視覺回歸（12 主題組合） | | | | | ✅ | |
| 操作驗證（按鈕/sheet/捲動/列印） | | | | | ✅ | |
| 跨瀏覽器驗證（Chromium/Firefox/WebKit） | | | | | ✅ | |
| 效能基準（Lighthouse/LCP/CLS） | | | | | ✅ | |
| a11y 自動掃描（axe-core/ARIA） | | | | | ✅ | |
| 邊緣情境 + 回歸測試 | | | | | ✅ | |
| 回報 QC PASS / FAIL | | | | | ✅ | |
| 質疑 11 視角 + 產出 Challenge Report | | | | | | ✅ |
| 勾選 tasks.md checkbox | | | ✅ | | | |
| 派出 Subagent 平行作業 | | | ✅ | ✅ | ✅ | ✅ |

## Teammate 與 Subagent 的區別

```
Teammate = PM 透過 Agent(name, team_name) 派出的團隊成員
  - 有名字、有角色、加入 Team config
  - 可被其他 Teammate 用 SendMessage 找到
  - idle 後可被喚醒繼續工作
  - 直接對 PM 負責

Subagent = Teammate 自己再派出的助手
  - 沒有名字、不加入 Team
  - 對派出的 Teammate 負責
  - 做完就結束
```

## Subagent 規則

**核心原則：subagent 只能做派出的 Teammate 自己能做的事。**

| Teammate（派出者） | subagent 可做 | subagent 不可做 |
|-------------------|-------------|----------------|
| **工程師** | 寫 code（worktree 隔離）、debug | APPROVE、跑正式測試 |
| **Reviewer** | 讀 code、靜態分析、寫報告檔 | 改程式碼／設定檔 |
| **QC** | 跑 test/tsc、Playwright 截圖、寫報告檔 | 改程式碼／設定檔 |
| **Challenger** | 跑掃描工具（audit/lighthouse）、讀 code、寫報告檔 | 改程式碼／設定檔、做決定 |

- 只有工程師可派「寫入型」subagent
- 工程師的 subagent 產出必須經 Code Reviewer 審查
