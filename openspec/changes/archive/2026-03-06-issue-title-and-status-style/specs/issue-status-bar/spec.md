## ADDED Requirements

### Requirement: Issue 標題不含前綴
建立 Issue 時 title 格式 SHALL 為 `Owner: 修改描述前50字`，不含 `[trip-edit]` 前綴。labels 維持 `["trip-edit", tripSlug]` 不變。

#### Scenario: 送出修改請求
- **WHEN** 使用者在 edit 頁面送出修改請求
- **THEN** GitHub Issue title 為 `{owner}: {text.substring(0, 50)}`，不含 `[trip-edit]` 前綴

#### Scenario: labels 維持不變
- **WHEN** 使用者送出修改請求
- **THEN** Issue labels 仍為 `["trip-edit", tripSlug]`

### Requirement: 左側色條顯示狀態
每個 `.issue-item` SHALL 以左側 3px border-left 色條顯示狀態，取代原本的 `.status-dot` 圓點。

#### Scenario: open issue 顯示綠色色條
- **WHEN** Issue 狀態為 open
- **THEN** `.issue-item` 有 class `open`，左側色條為 `var(--success)` 綠色

#### Scenario: closed issue 顯示灰色色條
- **WHEN** Issue 狀態為 closed
- **THEN** `.issue-item` 有 class `closed`，左側色條為 `var(--text-muted)` 灰色

### Requirement: closed issue 淡化顯示
closed 狀態的 issue-item SHALL 整列 opacity 降低至 0.55，與 open 項目形成視覺對比。

#### Scenario: closed issue 淡化
- **WHEN** Issue 狀態為 closed
- **THEN** `.issue-item.closed` 的 opacity 為 0.55

#### Scenario: open issue 不淡化
- **WHEN** Issue 狀態為 open
- **THEN** `.issue-item.open` 的 opacity 為 1（預設值）

### Requirement: meta 行不顯示狀態文字
Issue meta 行 SHALL 只顯示 `#number · date`，移除 open/closed 文字（狀態已由色條傳達）。

#### Scenario: meta 行格式
- **WHEN** Issue 列表渲染
- **THEN** meta 行格式為 `#23 · 2026-03-05`，不含 `open` 或 `closed` 文字

### Requirement: 不新增 font-size
所有樣式變更 SHALL 沿用既有 CSS 變數（`--fs-sm` 等），禁止新增硬編碼 font-size。

#### Scenario: CSS 無新增 font-size
- **WHEN** 檢視變更的 CSS
- **THEN** 無任何新增的 `font-size` 宣告
