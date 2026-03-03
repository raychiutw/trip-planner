## ADDED Requirements

### Requirement: 建議卡片優先度背景色

建議卡片 SHALL 依 priority 欄位顯示不同背景色，opacity 已更新以增強視覺識別度：

| 優先度 | 亮色背景 | 深色背景 |
|--------|---------|---------|
| high | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.12)` |
| medium | `rgba(234, 179, 8, 0.15)` | `rgba(234, 179, 8, 0.12)` |
| low | `rgba(34, 197, 94, 0.10)` | `rgba(34, 197, 94, 0.15)` |

#### Scenario: high 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=high 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(239, 68, 68, 0.15)` 淡紅色（原 `0.08`，現 `0.15`）

#### Scenario: high 優先度卡片深色模式

- **WHEN** 深色模式渲染 priority=high 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(239, 68, 68, 0.12)` 淡紅色

#### Scenario: medium 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=medium 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(234, 179, 8, 0.15)` 淡黃色（原 `0.08`，現 `0.15`）

#### Scenario: low 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=low 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(34, 197, 94, 0.10)` 淡綠色（原無底色，現新增）

#### Scenario: low 優先度卡片深色模式

- **WHEN** 深色模式渲染 priority=low 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(34, 197, 94, 0.15)` 淡綠色

#### Scenario: high/medium 深色模式背景維持不變

- **WHEN** 深色模式渲染 priority=high 的建議卡片
- **THEN** 卡片背景 SHALL 維持 `rgba(239, 68, 68, 0.12)`（與前版相同）

### Requirement: 建議卡片優先度圓點

每張建議卡片標題前方 SHALL 顯示一個 8px 圓點，顏色對應優先度：

| 優先度 | 圓點顏色 | 說明 |
|--------|---------|------|
| high | `#EF4444` | 紅色，不變 |
| medium | `#EAB308` | 黃色，不變 |
| low | `#22C55E` | 綠色（原 `#F97316` 橘色，現改為綠色） |

圓點 SHALL 使用 CSS `::before` 偽元素實作。

#### Scenario: high 圓點顏色

- **WHEN** 渲染 priority=high 的建議卡片
- **THEN** 標題前方 SHALL 顯示 `#EF4444` 紅色 8px 圓點

#### Scenario: medium 圓點顏色

- **WHEN** 渲染 priority=medium 的建議卡片
- **THEN** 標題前方 SHALL 顯示 `#EAB308` 黃色 8px 圓點

#### Scenario: low 圓點改為綠色

- **WHEN** 渲染 priority=low 的建議卡片
- **THEN** 標題前方圓點 SHALL 顯示 `#22C55E` 綠色（原 `#F97316` 橘色）

#### Scenario: high/medium 圓點色彩不變

- **WHEN** 渲染 priority=high 的建議卡片
- **THEN** 標題前方圓點 SHALL 顯示 `#EF4444` 紅色（與前版相同）

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
