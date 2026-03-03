## MODIFIED Requirements

### Requirement: 全旅程交通統計 — 常駐展開

「全旅程交通統計」區塊（由 `renderTripDrivingStats` 產生，位於所有日程卡片之後）SHALL 預設展開且不可折疊。

- 最外層摘要列 SHALL NOT 具備 `role="button"` 或 `aria-expanded` 屬性
- 最外層摘要列 SHALL NOT 包含 `<span class="arrow">` 元素
- 摘要列下方的交通明細（類型小計 + 各日分類）SHALL 永遠可見，不依賴使用者點擊
- 各日明細行（Day 1、Day 2…）SHALL 同樣移除 toggle 行為：無 `role="button"`、無 `aria-expanded`、無 `.arrow`，其子明細永遠顯示

### Requirement: 當日交通（renderDayTransport）保持折疊

每個日程卡片內的「當日交通」區塊 SHALL 維持現有折疊行為不變：

- `.col-row[role="button"]` 保留
- `aria-expanded` 保留
- `<span class="arrow">＋</span>` 保留
- 點擊後切換 `.col-detail` 展開/收合

#### Scenario: 頁面載入後全旅程交通統計可見

- **WHEN** 使用者載入 `index.html`
- **THEN** 「全旅程交通統計」及其所有子明細（類型小計、各日分鐘數）SHALL 無需任何互動即可看到

#### Scenario: 全旅程交通統計列不可點擊

- **WHEN** 使用者點擊「全旅程交通統計」標頭列
- **THEN** 明細內容 SHALL NOT 折疊或收起
- **AND** 該列 SHALL NOT 具備 button 的鍵盤焦點行為

#### Scenario: 當日交通折疊行為不受影響

- **WHEN** 使用者點擊任一日程內的「當日交通」列
- **THEN** 該日的交通明細 SHALL 如既有行為展開或收合
