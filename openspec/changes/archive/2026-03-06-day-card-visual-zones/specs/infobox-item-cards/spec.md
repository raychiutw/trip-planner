## ADDED Requirements

### Requirement: 每筆餐廳/購物獨立卡片

`.restaurant-choice` 元素 SHALL 具備 `accent-light` 底色、圓角（`var(--radius-sm)`）、內距（padding），成為視覺上可辨識的獨立小卡片。

#### Scenario: 餐廳推薦顯示為獨立卡片

- **WHEN** infoBox type 為 `restaurants` 且包含多間餐廳
- **THEN** 每間餐廳 SHALL 渲染為獨立的 `accent-light` 底色圓角卡片，卡片之間有間距

#### Scenario: 購物推薦顯示為獨立卡片

- **WHEN** infoBox type 為 `shopping` 且包含多間購物點
- **THEN** 每間購物點 SHALL 渲染為獨立的 `accent-light` 底色圓角卡片

#### Scenario: 深色模式卡片外觀

- **WHEN** 使用者切換至深色模式
- **THEN** `.restaurant-choice` 底色 SHALL 自動使用 `--accent-light` 深色值

### Requirement: 手機版直排

手機版（<768px）`.restaurant-choice` 卡片 SHALL 垂直堆疊，每張佔整列寬度。

#### Scenario: 手機版多筆餐廳直排

- **WHEN** 使用者在 <768px 裝置查看包含 3 間餐廳推薦的 infoBox
- **THEN** 3 張卡片 SHALL 垂直堆疊，每張佔滿容器寬度

### Requirement: 桌機版 grid 排列

桌機版（≥768px）`.restaurant-choice` 卡片 SHALL 以 CSS grid 橫向排列，欄數依項目數量決定：

- 1 張 → 1 欄（整列寬）
- 偶數 → 2 欄
- 奇數（≥3）→ 3 欄

#### Scenario: 桌機版 3 張餐廳三欄排列

- **WHEN** 使用者在 ≥768px 裝置查看包含 3 間餐廳推薦的 infoBox
- **THEN** 3 張卡片 SHALL 在同一列橫向排列，各佔 1/3 寬度

#### Scenario: 桌機版 2 張購物兩欄排列

- **WHEN** 使用者在 ≥768px 裝置查看包含 2 間購物推薦的 infoBox
- **THEN** 2 張卡片 SHALL 在同一列橫向排列，各佔 1/2 寬度

#### Scenario: 桌機版 4 張兩欄排列

- **WHEN** 使用者在 ≥768px 裝置查看包含 4 間推薦的 infoBox
- **THEN** 4 張卡片 SHALL 以 2 欄排列（2+2），每張佔 1/2 寬度

#### Scenario: 桌機版 5 張三欄排列

- **WHEN** 使用者在 ≥768px 裝置查看包含 5 間推薦的 infoBox
- **THEN** 5 張卡片 SHALL 以 3 欄排列（第一列 3 張、第二列 2 張靠左）

#### Scenario: 桌機版 1 張整列寬

- **WHEN** 使用者在 ≥768px 裝置查看僅包含 1 間推薦的 infoBox
- **THEN** 該卡片 SHALL 佔整列寬度
