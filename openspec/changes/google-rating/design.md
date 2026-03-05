# Design: google-rating

## 設計決策

### D1：googleRating 欄位型別與適用範圍

`googleRating` 為 **選填數字欄位，範圍 1.0–5.0**，可出現在以下三種物件：

- Timeline event（`days[].timeline[]`）
- Restaurant（`infoBox.restaurants[]`）
- Shop（`infoBox.shops[]`）

選填設計原因：部分地點（交通節點、純描述型 event、臨時餐廳未定）沒有 Google 評分頁面；資料填充需逐步完成，不宜設為必填。

---

### D2：渲染格式

以 `iconSpan('star')` 星號圖示 + `toFixed(1)` 數字並排顯示，例如 `★ 4.5`。

- **Timeline event**：評分顯示於標題旁（blogUrl 連結之後）
- **Restaurant**：評分加入 meta 行（與 `hours`、`reservation` 同列）
- **Shop**：評分加入 meta 行（與 `hours` 同列）
- 欄位不存在時，不輸出任何 HTML（保持向後相容）

---

### D3：CSS class 設計

新增 `.google-rating` class：

- 星號 icon：`color: var(--accent)`（沿用全站 accent 色，與標籤、連結一致）
- 數字：繼承正常文字色（不另設色，避免視覺雜訊）
- 版型：`display: inline-flex; align-items: center; gap: 2px;`（與其他 meta 元素對齊）

**不建立獨立 CSS 元件**，`.google-rating` 直接放在既有 meta 行內，維持輕量原則。

---

### D4：R12 品質規則——warn 模式

R12 採 **`console.warn` 模式**，不使 `npm test` 失敗（非 strict）。

理由：`googleRating` 資料需透過 `/tp-rebuild` 逐步補齊，現階段行程 JSON 均無此欄位，若設為 strict 將立即造成大量測試失敗。Warn 模式讓規則在代碼中明確存在，並在 CI 輸出中可見，待資料補齊後可升為 strict。

**觸發條件**：
- Timeline event 為實體地點類（非 transit、非「餐廳未定」、非純描述型）且缺少 `googleRating`
- Restaurant 物件缺少 `googleRating`

**警告格式**：`Day X "${title}" missing googleRating`

---

### D5：Info 面板 highlights 移除方式

僅從 `renderInfoPanel(data)` 移除 highlights 的渲染呼叫（或相關 HTML 段落）。

- `renderHighlights` 函式本身**不刪除**（保留供主內容區使用）
- Info panel 其餘卡牌（倒數計時、行程統計、建議）**完全不受影響**
- 主內容區（day cards 上方）的 highlights 顯示**完全不受影響**

---

### D6：資料填充不在本次範圍

本次異動只完成：
1. JSON 結構定義（schema 驗證新增選填欄位）
2. 渲染層（有值才顯示）
3. R12 品質規則（warn 模式）

**`data/trips/*.json` 的 `googleRating` 實際數值不在本次異動範圍內。** 資料填充將由後續 `/tp-rebuild` 指令執行。
