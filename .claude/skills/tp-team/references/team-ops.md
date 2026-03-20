# TeamCreate 操作 + Task List + notes.md

## Agent Teams 機制（官方）

```
TeamCreate("change-xxx")
  → 建立 team config: ~/.claude/teams/change-xxx/config.json
  → 建立 task list: ~/.claude/tasks/change-xxx/

Agent(name: "engineer", team_name: "change-xxx")
  → Teammate 加入 team → 寫入 config.json members
  → 有名字、可被 SendMessage、idle 後可被喚醒
```

### 持久性

| 項目 | 跨 session？ |
|------|:-----------:|
| Team config（成員名單） | ✅ 持久 |
| Task list（任務狀態） | ✅ 持久 |
| Teammate 對話記憶 | ❌ 消失 |
| SendMessage 歷史 | ❌ 消失 |

下次 session 可重新 spawn 同名 Teammate 加入同一 Team，透過 task list 恢復進度。

## PM 啟動 Team 的步驟

```
Step 0: 檢查 team 是否已存在
  Read ~/.claude/teams/{team-name}/config.json
  → 存在：跳到 Step 2（不需要再 TeamCreate）
  → 不存在：執行 Step 1

Step 1: 建立 Team（僅首次）
  TeamCreate("change-xxx")

Step 2: 派 Teammate（各自 run_in_background）
  Agent(name: "engineer",   team_name: "change-xxx", prompt: 模板)
  Agent(name: "reviewer",   team_name: "change-xxx", prompt: 模板)
  Agent(name: "qc",         team_name: "change-xxx", prompt: 模板)
  Agent(name: "challenger", team_name: "change-xxx", prompt: 模板)

  ※ 跨 session 重新 spawn 同名 Teammate 即可加入既有 team
  ※ Teammate 讀 TaskList + notes.md 恢復之前的進度和記憶

Step 3: 用 TaskCreate 建立任務，TaskUpdate 指派 owner
  Teammate 完成後 TaskUpdate status=completed
  Teammate 檢查 TaskList 認領下一個任務

Step 4: PM 收到結果 → 回報 Key User → 驗收 → commit

Step 5: 完成後 shutdown
  SendMessage({to: "engineer", message: {type: "shutdown_request"}})
  （對每個 Teammate 都發）
```

### 所有任務都用 Team 處理

**不分簡單或複雜，任何任務都建 Team 走完整流程。**
- 確保每個改動都經過 Review + QC + Challenger 檢查
- 避免「這個很簡單不用 review」導致的品質漏洞
- 跨 session 繼續：team 已存在，直接派 Teammate 加入，不需 TeamCreate

### 暫存檔規則

**Teammate 產生的暫存檔案（截圖、snapshot MD 等）一律放在 `.temp/` 目錄內。**

- QC 截圖：`.temp/qc-*.png`
- Reviewer 截圖：`.temp/review-*.png`
- Challenger 截圖：`.temp/challenge-*.png`
- Snapshot MD：`.temp/snapshot-*.md`
- 其他暫存：`.temp/*`

**Key User Approve 後、PM commit 之前**，PM 必須刪除 `.temp/` 目錄：
```bash
rm -rf .temp/
```

`.temp/` 已加入 `.gitignore`，不會被 commit。

---

### Teammate 命名規則（固定名字，重複使用）

**固定 4 個角色名字，不要每次建新名字：**

| 角色 | 固定名字 | 並行時 |
|------|---------|--------|
| 工程師 | `engineer` | `engineer-a` + `engineer-b`（最多 3 人） |
| Reviewer | `reviewer` | 只需 1 人 |
| QC | `qc` | 只需 1 人 |
| Challenger | `challenger` | 只需 1 人 |

- ❌ 錯誤：`reviewer` → `reviewer-2` → `reviewer-3` → `reviewer-r2`
- ✅ 正確：每次都 spawn `name: "reviewer"`，同名成員回歸 team
- Team config 會記住成員，重新 spawn 同名 = 同一個人回來接手
- shutdown 後再 spawn 同名，不需要建新名字

## tasks.md + Task List 雙軌

```
tasks.md（OpenSpec，git 追蹤）     Task List（Agent Teams，本機）
──────────────────────────       ─────────────────────────
紀錄「做什麼」（需求層）            紀錄「誰在做」（執行層）
PM + 工程師勾 checkbox             Teammate 用 TaskUpdate 更新
change 完成後 archive              team 完成後 shutdown
跨 session 持久（git）             跨 session 持久（~/.claude/tasks/）
驗收依據                           即時協調
```

**規則：**
- tasks.md = 唯一的需求來源（Source of Truth）
- PM 從 tasks.md 拆出 Task List 細任務
- 工程師完成後同時更新兩邊（TaskUpdate + 勾 tasks.md）
- archive 時驗證 tasks.md 全勾

## notes.md（跨 session 記憶）

位置：`openspec/changes/{change-name}/notes.md`

```markdown
# Notes — {change-name}

## 決策紀錄

### {日期} — {決策標題}
- **提出者**：{角色}
- **決策**：{選了什麼}
- **替代方案**：{考慮過但放棄的}
- **原因**：{為什麼選這個}

## 挑戰紀錄

### {日期} — Challenger: {視角}
- **問題**：{質疑內容}
- **嚴重度**：🔴高 / 🟡中 / 🟢低
- **PM 裁決**：修 / 接受風險 / 延後
- **Key User**：Approve / 未呈報

## 踩坑紀錄

### {日期} — {問題標題}
- **發現者**：{角色}
- **現象**：{發生什麼}
- **根因**：{為什麼}
- **解法**：{怎麼修的}

## 跨 session 交接

### Session N → Session N+1
- **進度**：tasks 1.1-1.4 完成，1.5 進行中
- **待處理**：Reviewer 提了 2 個 REQUEST CHANGES
- **注意**：{需要特別注意的事}
```

### 誰可以寫 notes.md

| 角色 | 可寫？ | 說明 |
|------|:------:|------|
| PM | ✅ | 決策、裁決、交接 |
| 工程師 | ✅ | 踩坑紀錄 |
| Challenger | ✅ | 挑戰紀錄（notes.md + challenge-report.md） |
| Reviewer | ✅ | 審查報告（review-findings.md） |
| QC | ✅ | 測試報告（qc-report.md） |

**規則澄清**：報告檔（notes.md、*-report.md、*-findings.md）是資訊傳遞，不是程式碼。所有角色都可以寫報告檔。禁止的是修改程式碼（.tsx/.ts/.css/.html）和設定檔。
