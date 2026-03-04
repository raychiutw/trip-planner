## ADDED Requirements

### Requirement: /tp-issue skill 定義
`/tp-issue` SHALL 從 GitHub Issues 讀取行程修改請求並套用。skill 檔案位於 `.claude/commands/tp-issue.md`。此為原 `/render-trip` 的 Issue 處理流程。

#### Scenario: 讀取 Issues
- **WHEN** 使用者執行 `/tp-issue`
- **THEN** SHALL 執行 `git pull origin master`
- **AND** SHALL 執行 `gh issue list --label trip-edit --state open --json number,title,body`
- **AND** 無 open Issue 時回報「沒有待處理的請求」並結束

#### Scenario: 處理單一 Issue
- **WHEN** 有 open Issue
- **THEN** SHALL 解析 Issue body JSON（取得 owner、tripSlug、text）
- **AND** SHALL 讀取 `data/trips/{tripSlug}.json`
- **AND** SHALL 依 Issue text 內容局部修改行程 JSON（只改 text 描述的部分，不全面重跑 R1-R10）
- **AND** 修改的部分 SHALL 符合 R1-R10 品質規則（如新增餐廳須符合 R3 格式）
- **AND** SHALL 同步更新 checklist、backup、suggestions（若修改影響到）

#### Scenario: 白名單檢查
- **WHEN** 修改完成後
- **THEN** SHALL 執行 `git diff --name-only` 確認只有 `data/trips/{tripSlug}.json` 被修改
- **AND** 有其他檔案被改時 SHALL `git checkout` 還原非白名單檔案

#### Scenario: 測試與提交
- **WHEN** 白名單檢查通過
- **THEN** SHALL 執行 `npm test`
- **AND** 通過 → commit push + `gh issue comment "✅ 已處理：{摘要}"` + `gh issue close`
- **AND** 失敗 → `git checkout .` + `gh issue comment "❌ 處理失敗：{錯誤}"` + `gh issue close`

### Requirement: /tp-issue 核心原則
`/tp-issue` SHALL 不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行。

#### Scenario: 模糊需求處理
- **WHEN** Issue text 描述模糊
- **THEN** SHALL 自行判斷最合理的方案執行，不使用 AskUserQuestion
