## ADDED Requirements

### Requirement: tp-edit 自然語言行程編輯

`/tp-edit` skill SHALL 接受自然語言描述，局部修改指定行程 JSON。修改前自動備份，修改後自動執行 tp-check 精簡 report。

#### Scenario: 指定 tripSlug 與描述

- **WHEN** 使用者執行 `/tp-edit {tripSlug} {自然語言描述}`
- **THEN** SHALL 讀取 `data/trips/{tripSlug}.json`
- **AND** 依描述內容局部修改行程 JSON
- **AND** 修改後執行 tp-check 精簡模式

#### Scenario: 未指定 tripSlug

- **WHEN** 使用者執行 `/tp-edit` 未帶 tripSlug
- **THEN** SHALL 讀取 `data/trips.json` 列出所有行程供選擇

#### Scenario: 修改前備份

- **WHEN** tp-edit 即將修改行程 JSON
- **THEN** SHALL 先執行備份流程（見 trip-json-backup spec）

#### Scenario: 局部修改範圍

- **WHEN** tp-edit 執行修改
- **THEN** SHALL 只修改描述涉及的部分（如特定日的午餐、新增景點到特定日）
- **AND** SHALL NOT 全面重跑 R1-R12（全面修正使用 `/tp-rebuild`）

#### Scenario: 修改部分符合品質規則

- **WHEN** tp-edit 修改了某個 entry
- **THEN** 被修改的部分 SHALL 符合 R1-R12 對應的品質規則

#### Scenario: 連動更新

- **WHEN** tp-edit 的修改影響到 checklist、backup、suggestions
- **THEN** SHALL 同步更新受影響的欄位

#### Scenario: 檔案白名單

- **WHEN** tp-edit 執行
- **THEN** SHALL 只修改 `data/trips/{tripSlug}.json`
- **AND** SHALL NOT 修改 js/css/html/tests/data/trips.json 等其他檔案

#### Scenario: 修改後驗證

- **WHEN** tp-edit 完成修改
- **THEN** SHALL 執行 `git diff --name-only` 確認只改了白名單檔案
- **AND** 有其他檔案被改時 SHALL `git checkout` 還原

### Requirement: tp-issue 改用 tp-edit

`/tp-issue` SHALL 改為 tp-edit 的 GitHub Issue 驅動包裝層。

#### Scenario: Issue 處理流程

- **WHEN** `/tp-issue` 處理一個 GitHub Issue
- **THEN** SHALL 解析 Issue body → 提取 tripSlug 和 text
- **AND** 以 tp-edit 邏輯執行局部修改（含備份、check）
- **AND** 修改通過後 commit + push + close Issue

#### Scenario: add-spot 功能整合

- **WHEN** 使用者想新增景點到行程
- **THEN** SHALL 使用 `/tp-edit` 以自然語言描述（如「Day 2 加入美麗海水族館」）
- **AND** `/add-spot` skill SHALL 被移除

### Requirement: 棄用 /add-spot

`/add-spot` skill SHALL 被移除，功能由 `/tp-edit` 取代。

#### Scenario: 移除 add-spot 檔案

- **WHEN** 實作本變更
- **THEN** SHALL 刪除 `.claude/commands/add-spot.md`
