# Spec: google-rating（新增能力）

## ADDED Requirements

### Requirement: googleRating 欄位定義

`googleRating` 為選填數字欄位，範圍 1.0–5.0，可出現於 timeline event、restaurant 物件、shop 物件。欄位不存在時渲染層 SHALL 靜默略過，不產生錯誤。

#### Scenario: timeline event 含 googleRating

- **GIVEN** timeline event 物件含有 `googleRating: 4.5`
- **WHEN** `renderTimelineEvent` 渲染該 event
- **THEN** 輸出 HTML SHALL 包含星號圖示（`iconSpan('star')`）與文字 `4.5`
- **AND** 星號 SHALL 套用 `.google-rating` class，呈現 `var(--accent)` 色

#### Scenario: restaurant 含 googleRating

- **GIVEN** restaurant 物件含有 `googleRating: 4.3`
- **WHEN** `renderRestaurant` 渲染該餐廳
- **THEN** meta 行 SHALL 包含星號圖示與文字 `4.3`
- **AND** 評分顯示位置與 `hours`、`reservation` 在同一行

#### Scenario: shop 含 googleRating

- **GIVEN** shop 物件含有 `googleRating: 4.1`
- **WHEN** `renderShop` 渲染該 shop
- **THEN** meta 行 SHALL 包含星號圖示與文字 `4.1`
- **AND** 評分顯示位置與 `hours` 在同一行

#### Scenario: googleRating 缺失時不渲染

- **GIVEN** timeline event、restaurant 或 shop 物件不含 `googleRating` 欄位
- **WHEN** 對應的渲染函式執行
- **THEN** 輸出 HTML SHALL 不包含任何評分相關元素
- **AND** 其餘欄位渲染 SHALL 正常（不受影響）

### Requirement: googleRating 渲染格式

評分 SHALL 以 `iconSpan('star')` 星號圖示加上 `toFixed(1)` 格式的數字呈現，外層以 `.google-rating` class 包裝。

#### Scenario: 數字格式化

- **GIVEN** `googleRating` 值為整數（例如 `4`）
- **WHEN** 渲染評分
- **THEN** 顯示文字 SHALL 為 `4.0`（固定一位小數）

#### Scenario: CSS 色彩套用

- **WHEN** 渲染任一含 `googleRating` 的地點
- **THEN** 星號 icon SHALL 套用 `color: var(--accent)`
- **AND** 評分數字 SHALL 繼承正常文字色（不另設色）
