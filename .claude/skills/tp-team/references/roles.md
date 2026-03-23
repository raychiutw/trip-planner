# 角色權責矩陣

**核心原則：每個活動只有一個角色能做，其他角色的工作就是自己不能做的。**

## 常駐角色（每個 change 都參與）

| 活動 | Key User | PM | Architect | Designer | Engineer | Reviewer | QA | Security |
|------|:--------:|:--:|:---------:|:--------:|:--------:|:--------:|:--:|:--------:|
| 提出需求 / Approve / Reject | ✅ | | | | | | | |
| 產品建議、需求分析、任務拆分 | | ✅ | | | | | | |
| 派 Teammate、協調團隊 | | ✅ | | | | | | |
| git commit / push / archive | | ✅ | | | | | | |
| PM 驗收、回報 Key User | | ✅ | | | | | | |
| 架構審查（資料流 + edge cases） | | | ✅ | | | | | |
| 效能影響分析 + 擴展性評估 | | | ✅ | | | | | |
| 需求方向質疑 + scope 建議 | | | ✅ | | | | | |
| 設計系統建立 / 維護 | | | | ✅ | | | | |
| UI/UX 計畫審查 | | | | ✅ | | | | |
| 視覺稽核 + CSS 修復 | | | | ✅ | | | | |
| 調查問題、查 log、debug | | | | | ✅ | | | |
| 撰寫/修改程式碼、設定檔 | | | | | ✅ | | | |
| 撰寫 unit test（TDD） | | | | | ✅ | | | |
| 執行 tsc + npm test（必須全過） | | | | | ✅ | | | |
| 撰寫 OpenSpec 文件內容 | | | | | ✅ | | | |
| 勾選 tasks.md checkbox | | | | | ✅ | | | |
| 審查正確性 + 可讀性 + 測試覆蓋 | | | | | | ✅ | | |
| 審查跨模組 side effect + 向後相容 | | | | | | ✅ | | |
| 標記技術債 + Design Pattern 建議 | | | | | | ✅ | | |
| 執行 /tp-code-verify + /tp-ux-verify | | | | | | ✅ | | |
| APPROVE / REQUEST CHANGES | | | | | | ✅ | | |
| 撰寫 E2E 測試腳本（Playwright） | | | | | | | ✅ | |
| 截圖比對 + 視覺回歸 | | | | | | | ✅ | |
| 操作驗證（按鈕/sheet/捲動/列印） | | | | | | | ✅ | |
| 跨瀏覽器驗證（3 引擎） | | | | | | | ✅ | |
| 效能基準（Lighthouse/LCP/CLS） | | | | | | | ✅ | |
| a11y 自動掃描（axe-core/ARIA） | | | | | | | ✅ | |
| 回報 QA PASS / FAIL | | | | | | | ✅ | |
| OWASP Top 10 審查 | | | | | | | | ✅ |
| STRIDE 威脅建模 | | | | | | | | ✅ |
| Secret 掃描 + CVE 檢查 | | | | | | | | ✅ |
| 回報 SECURITY PASS / FAIL | | | | | | | | ✅ |

## 按需角色（特定情境才召喚）

| 活動 | DevOps | Debugger |
|------|:------:|:--------:|
| 建立 PR（`/ship`） | ✅ | |
| Merge + 部署驗證（`/land-and-deploy`） | ✅ | |
| 金絲雀監控（`/canary`） | ✅ | |
| 根因分析（`/investigate`） | | ✅ |
| Bug 修復（程式碼變更） | | ✅ |

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
| **Engineer** | 寫 code（worktree 隔離）、debug | APPROVE、跑正式測試 |
| **Architect** | 讀 code、分析架構、寫報告檔 | 改程式碼／設定檔 |
| **Designer** | 讀 code、截圖、寫報告檔、改 CSS（視覺修復） | 改邏輯程式碼 |
| **Reviewer** | 讀 code、靜態分析、寫報告檔 | 改程式碼／設定檔 |
| **QA** | 跑 test/tsc、Playwright 截圖、寫報告檔 | 改程式碼／設定檔 |
| **Security** | 跑掃描工具（audit/CVE）、讀 code、寫報告檔 | 改程式碼／設定檔 |
| **DevOps** | 執行部署指令、監控 | 改應用程式碼 |
| **Debugger** | debug、修 code（worktree 隔離） | APPROVE |

- 只有 Engineer 和 Debugger 可派「寫入型」subagent
- 寫入型 subagent 產出必須經 Reviewer 審查
