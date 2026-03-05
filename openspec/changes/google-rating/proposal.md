# Proposal: google-rating

## Why

### Google 評分顯示

使用者在規劃行程時，需要快速判斷各景點、餐廳、購物地點的品質。目前行程 JSON 和渲染層均無 Google 評分欄位，使用者無法從行程頁面直接得知地點評價，需另開 Google 地圖查詢，造成不便。加入 `googleRating` 欄位並於 UI 顯示，可讓使用者一眼判斷地點品質。

### Info 面板移除行程特色卡牌

桌機右側欄（info panel）目前顯示「行程特色」（highlights）卡牌，但該卡牌內容已在主內容區（day cards 上方）重複顯示。Info 面板空間有限，移除重複的 highlights 卡牌可讓倒數計時、行程統計、建議等更重要的資訊更突出。

---

## What Changes

### Part 1：Google 評分

1. **JSON 資料結構**：在 timeline event、restaurant 物件、shop 物件上新增選填的 `googleRating` 欄位（數字，1.0–5.0）
2. **渲染**：`renderTimelineEvent`、`renderRestaurant`、`renderShop` 在欄位存在時，以星號圖示 + 數字顯示評分
3. **CSS**：新增 `.google-rating` class，星號使用 `var(--accent)` 色，數字使用正常文字色
4. **Schema 驗證**：`schema.test.js` 加入 `googleRating` 的選填數字驗證
5. **品質規則 R12**：`quality.test.js` 新增 warn 模式規則，檢查實體地點類 timeline event 與所有餐廳是否具備 `googleRating`

### Part 2：移除 Info 面板 highlights 卡牌

1. 從 `renderInfoPanel(data)` 中移除 highlights 渲染呼叫
2. 主內容區的 highlights 顯示保持不變
3. `renderHighlights` 函式本身保留（仍用於主內容區）

---

## Capabilities

| 能力 | 異動類型 |
|---|---|
| `google-rating` | 新增 |
| `trip-json-validation` | 修改（新增 googleRating schema 驗證） |
| `trip-enrich-rules` | 修改（新增 R12 規則） |
| `ai-highlights-card` | 修改（從 info panel 移除 highlights 渲染） |

---

## Impact

| 檔案 | 說明 |
|---|---|
| `js/app.js` | 渲染層：`renderTimelineEvent`、`renderRestaurant`、`renderShop` 加入評分顯示；`renderInfoPanel` 移除 highlights 呼叫 |
| `css/style.css` | 新增 `.google-rating` class 樣式 |
| `data/trips/*.json` | 結構定義新增 `googleRating` 欄位（**資料填充不在本次異動範圍，待後續 /tp-rebuild 補齊**） |
| `tests/json/schema.test.js` | 新增 `googleRating` 選填欄位驗證 |
| `tests/json/quality.test.js` | 新增 R12 warn 模式規則 |

### 不受影響

- `checklist`、`backup`、`suggestions` 等欄位不受任何異動
- `renderHighlights` 函式本身不移除，主內容區 highlights 顯示不變
