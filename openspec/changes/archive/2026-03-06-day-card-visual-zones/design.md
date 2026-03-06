## Context

每天的 section（`#tripContent section`）底色為 `card-bg`（`#EDE8E3`），內含天氣、飯店、交通統計、時間軸等區域，目前無視覺分區。infoBox 內的多筆餐廳/購物用 `.restaurant-choice` 渲染，僅有 `padding: 6px 0`，彼此無間隔。

現有色彩層級：
```
card-bg (#EDE8E3)  →  section 卡片底色
accent-light (#F5EDE8)  →  hotel-sub、info-box(dark)、hw-block、ov-card
white (#FAF8F6)  →  hw-block 預設
```

## Goals / Non-Goals

**Goals:**
- 用 `accent-light` 底色塊區分「概況區」與「時間軸主體」
- 讓 infoBox 內每筆餐廳/購物點成為可辨識的獨立小卡片
- 桌機版利用寬度優勢讓小卡片橫向排列
- 移除無用的 budget 渲染程式碼

**Non-Goals:**
- 不修改時間軸的垂直線/圓點樣式
- 不修改 infoBox 的外層容器（`.info-box`）樣式
- 不新增色彩變數（只用既有 `accent-light`）
- 不修改行程 JSON 結構

## Decisions

### D1: 概況區 wrapper

在 `renderDayContent()` 中，將天氣、飯店、交通統計三者包在一個 `<div class="day-overview">` 內。CSS 為此 div 加上 `background: var(--accent-light); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 12px;`。

**理由**：一個 wrapper div + 一條 CSS 規則，改動最小。不影響各子元件的內部樣式。

### D2: `.restaurant-choice` 卡片化

給 `.restaurant-choice` 加上 `background: var(--accent-light); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px;`。

**理由**：`.restaurant-choice` 同時被 `renderRestaurant()` 和 `renderShop()` 使用，一條 CSS 規則即可讓所有餐廳/購物小卡片生效。

### D3: 桌機版 grid 排列

在 `renderInfoBox()` 的 `restaurants` 和 `shopping` case 中，將多筆 `.restaurant-choice` 包在一個 `<div class="info-box-grid">` 內。

CSS grid 規則：
```
.info-box-grid        → 手機版無 grid（直排）
@media (min-width: 768px):
  .info-box-grid      → display: grid; gap: 8px;
  .info-box-grid-1    → grid-template-columns: 1fr
  .info-box-grid-even → grid-template-columns: repeat(2, 1fr)
  .info-box-grid-odd  → grid-template-columns: repeat(3, 1fr)
```

JS 依 items 數量加對應 class：1 張 → `grid-1`、偶數 → `grid-even`、奇數≥3 → `grid-odd`。

**理由**：用 class 切換欄數比 CSS `auto-fit` 更精確可控，且邏輯簡單（只看 length 的奇偶）。

### D4: 移除 budget

直接刪除 `renderBudget()` 函式、`renderDayContent()` 中的 `if (content.budget)` 分支、以及 CSS 中的 `.budget-table` / `.budget-total` 規則。所有行程 JSON 的每日 content 中無 budget 欄位，不會造成任何功能影響。

## Risks / Trade-offs

- **[概況區內部元件間距]** → wrapper 加了 padding 後，子元件原有的 padding/margin 可能導致雙重間距。需檢查 `.hourly-weather`、`.col-row`、`.driving-stats` 的外邊距，必要時調整。
- **[`.restaurant-choice` 已有 padding]** → 現有 `padding: 6px 0` 會被覆蓋為 `10px 12px`，確認不影響地圖連結和 meta 資訊的排版。
- **[深色模式]** → `accent-light` 的深色值已定義為 `#3D3330`，概況區和小卡片在深色模式下自動適配，不需額外處理。
