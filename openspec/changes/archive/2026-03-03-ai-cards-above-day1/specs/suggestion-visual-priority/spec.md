## MODIFIED Requirements

### Requirement: 資訊面板建議摘要

`renderInfoPanel()` SHALL 在統計區域新增「建議摘要」卡片，顯示各優先等級的項目數量。每個等級前方 SHALL 顯示對應顏色圓點。

格式：
- `● 高優先：N 項`
- `● 中優先：N 項`
- `● 低優先：N 項`

計數來源為 `suggestions.content.cards` 各 priority 的 `items.length`。

#### Scenario: 有三個等級的建議

- **WHEN** 行程 JSON 含 high=2、medium=3、low=1 筆建議
- **THEN** 資訊面板建議摘要卡片 SHALL 顯示「高優先：2 項」「中優先：3 項」「低優先：1 項」

#### Scenario: 某等級無項目

- **WHEN** 行程 JSON 某優先等級的 items 為空陣列
- **THEN** 該等級 SHALL 顯示「0 項」

#### Scenario: 無建議資料

- **WHEN** 行程 JSON 無 suggestions 區塊
- **THEN** 資訊面板 SHALL 不顯示建議摘要卡片

## ADDED Requirements

### Requirement: suggestions 為必填欄位

`validateTripData()` SHALL 在 trip JSON 缺少 `suggestions` 時產生 error。

#### Scenario: suggestions 缺失

- **WHEN** trip JSON 缺少 suggestions 欄位
- **THEN** `validateTripData()` SHALL 回傳 error「缺少 suggestions」

### Requirement: suggestions title 統一命名

所有 trip JSON 的 `suggestions.title` SHALL 為「AI 行程建議」。

#### Scenario: title 名稱

- **WHEN** 渲染 suggestions section header
- **THEN** 標題 SHALL 顯示「AI 行程建議」
