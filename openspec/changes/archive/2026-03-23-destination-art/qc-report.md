# QC Report — sticky-nav fix + DestinationArt

日期：2026-03-20  
測試環境：http://localhost:3000/  
測試工具：Playwright MCP（截圖 + DOM 驗證）  

---

## 1. sticky-nav 是否固定在頂部？

**PASS**

- CSS：`position: sticky; top: 0px; z-index: 200`
- 捲動後實測：`stickyRect.y = 0`（固定在頂部）
- 390px 和 320px 均確認 sticky nav 在捲動後仍固定於頂部

截圖：`dest-okinawa-scrolltop.png`（頂部）、`dest-okinawa-scrolled.png`（捲動後）

---

## 2. DestinationArt SVG 背景是否可見？

**PASS**

- `.destination-art` 元素存在，`position: absolute; inset: 0; z-index: 0; overflow: hidden`
- 位於 `.sticky-nav` 內部（`isInsideStickyNav: true`）
- SVG 有內容，沖繩行程：海浪波形（`Q60 28 120 38`）+ 圓形（太陽/島嶼）+ 船帆路徑
- SVG `<g opacity="0.18">`（淡淡插畫，不搶眼）
- 截圖可清楚看到 DayNav pill 後方有淡色 SVG 插畫

截圖：`dest-okinawa-top2.png`

---

## 3. 切換行程 — 沖繩/釜山 是否看到不同的 SVG？

**PASS**

沖繩 SVG（`okinawa-trip-2026-Ray`）：
- 路徑：`Q60 28 120 38`（海浪）
- 元素：circle（太陽）、path（船帆）、ellipse（島嶼）
- svgChildCount: 6

釜山 SVG（`busan-trip-2026-CeliaDemyKathy`）：
- 路徑：`Q40 8 80 28`（不同波形）+ `<line>` 元素（直線）

兩者路徑數值不同，確認為不同 SVG 插畫。

截圖：`dest-okinawa-top2.png`（沖繩）、`dest-busan-top.png`（釜山）

---

## 4. DayNav pill 可讀性 — SVG 背景是否干擾 pill 文字？

**PASS**

- `.sticky-nav > :not(.destination-art)` CSS rule 確保所有非 destination-art 子元素為 `position: relative; z-index: 1`
- SVG 在 z-index: 0，DayNav pills 在 z-index: 1 之上
- 截圖目視確認：pill 文字（7/29、7/30 等）清晰可讀，SVG 不遮擋

---

## 5. Dark mode — SVG opacity 是否降低？

**FAIL（功能未實作）**

- 此 app 目前無 dark mode CSS 實作（無 `prefers-color-scheme` media query，無 `[data-theme="dark"]` 規則）
- `.destination-art` CSS rules 中無 dark mode 對應樣式
- SVG opacity 由 SVG 內部 `<g opacity="0.18">` hardcode，不隨主題改變
- 手動設定 `data-theme="dark"` 後頁面主題色無任何變化

**結論：** Dark mode 功能本身未在此 app 實作，非 DestinationArt 的問題。若未來加入 dark mode，需補充 `.destination-art svg g { opacity: 0.1; }` 或類似規則。

截圖：`dest-okinawa-darkmode.png`（加 data-theme=dark 後無變化）

---

## 6. 320×568 小手機 — SVG 有沒有溢出或跑版？

**PASS**

實測座標（320px viewport）：
- destArtRect：`x=0, y=0, w=310, h=76, overflowsRight=false`
- stickyRect：`y=0, w=310`
- SVG 完整在 sticky-nav 範圍內，無溢出

截圖：`dest-okinawa-320.png`

---

## 總結

| 項目 | 結果 | 備註 |
|------|------|------|
| sticky-nav 固定頂部 | PASS | `position: sticky; top: 0` |
| DestinationArt SVG 可見 | PASS | opacity=0.18，淡色插畫 |
| 切換行程看到不同 SVG | PASS | 沖繩/釜山路徑不同 |
| DayNav pill 可讀性 | PASS | z-index 層級正確 |
| Dark mode opacity 降低 | FAIL | App 無 dark mode 實作，非本功能問題 |
| 320×568 無溢出跑版 | PASS | overflowsRight=false |

**整體：5 PASS / 1 FAIL（dark mode 為 app 層級功能缺失，非 DestinationArt bug）**
