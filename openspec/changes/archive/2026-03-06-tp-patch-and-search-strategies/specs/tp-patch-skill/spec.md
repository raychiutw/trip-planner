## ADDED Requirements

### Requirement: tp-patch 結構化指令格式

tp-patch skill SHALL 接受結構化參數：

```
/tp-patch --target <target> --field <field> [--trips <slug,...>]
```

- `--target`：必填，值為 `hotel` | `restaurant` | `shop` | `event` | `gasStation`
- `--field`：必填，值為任何合法欄位名稱（如 `googleRating`、`blogUrl`、`reservation`、`location`）
- `--trips`：選填，以逗號分隔的行程 slug，預設為全部行程

#### Scenario: 指定 target 和 field
- **WHEN** 使用者執行 `/tp-patch --target hotel --field googleRating`
- **THEN** skill SHALL 掃描所有行程的 hotel 物件，列出需更新 googleRating 的項目

#### Scenario: 限定特定行程
- **WHEN** 使用者執行 `/tp-patch --target restaurant --field reservation --trips okinawa-trip-2026-Ray,okinawa-trip-2026-AeronAn`
- **THEN** skill SHALL 只處理指定的兩個行程，不觸碰其他行程

#### Scenario: 缺少必填參數
- **WHEN** 使用者執行 `/tp-patch` 未提供 --target 或 --field
- **THEN** skill SHALL 顯示使用說明，不執行任何操作

### Requirement: tp-patch 掃描與摘要

skill SHALL 先掃描所有目標行程，輸出摘要後再開始搜尋。

#### Scenario: 掃描摘要輸出
- **WHEN** 掃描完成
- **THEN** SHALL 輸出格式為「共 N 行程、M 個 {target} 需更新 {field}」
- **AND** 列出每個行程的需更新項目數

### Requirement: tp-patch Agent 並行搜尋

skill SHALL 為每個行程啟動一個 Agent（sonnet），並行搜尋目標欄位的值。Agent SHALL 依 `search-strategies.md` 定義的搜尋方式執行。

#### Scenario: 並行 Agent 搜尋
- **WHEN** 掃描摘要確認有需更新的項目
- **THEN** SHALL 為每個行程啟動一個 Agent
- **AND** Agent SHALL 只搜尋不寫檔，回傳 JSON patch 結果

#### Scenario: Agent 搜尋策略來源
- **WHEN** Agent 開始搜尋
- **THEN** Agent prompt SHALL 包含 `search-strategies.md` 中對應 field 的搜尋方式

### Requirement: tp-patch 合併與驗證

Agent 回傳結果後，主流程 SHALL 合併 patch、備份、寫回 JSON、驗證。

#### Scenario: 備份與寫回
- **WHEN** Agent 全部完成
- **THEN** SHALL 為每個行程建立備份（同 tp-edit 備份邏輯）
- **AND** 只修改目標欄位，其他欄位完全不動
- **AND** 寫回行程 JSON

#### Scenario: 白名單驗證
- **WHEN** 寫回完成
- **THEN** SHALL 執行 `git diff --name-only` 確認只有 `data/trips/*.json` 被修改

#### Scenario: 測試與品質檢查
- **WHEN** 白名單驗證通過
- **THEN** SHALL 執行 `npm test`
- **AND** 對每個修改的行程執行 tp-check 精簡模式

### Requirement: tp-patch 不自動 commit

#### Scenario: 完成後不 commit
- **WHEN** 所有行程更新完成且測試通過
- **THEN** SHALL 不自動 commit，由使用者決定
