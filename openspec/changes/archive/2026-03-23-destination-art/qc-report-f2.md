# QC Report F-2 — DayArt 動態 Day Header

日期：2026-03-20  
測試環境：http://localhost:3000/  
測試工具：Playwright MCP（截圖 + DOM 驗證）  
暫存截圖：`.temp/qc-dayart-*.png`  

---

## 1. 每天 Day Header 有不同的 SVG 裝飾？

**PASS**

沖繩行程（okinawa-trip-2026-Ray）各天 SVG 主題：

| 天 | 行程 | SVG 主題 | 關鍵元素 |
|----|------|---------|---------|
| Day 1 | 北谷 | 購物/海灘 | rect（購物袋）+ ellipse + 波浪路徑 |
| Day 2 | 浮潛・瀨底 | 海洋/珊瑚 | ellipse + circle + 魚形/棕櫚路徑 |
| Day 3 | 水族館・古宇利 | 水族館 | ellipse + 三角形（魚fin）+ circle群 |
| Day 4 | 來客夢 | 購物中心 | rect + 購物袋路徑 + 汽車形 + circle |
| Day 5 | 首里城 | 城堡/機場 | rect + 城堡屋頂路徑（`M6 20 L23 4 L40 20`）+ 飛機 |

截圖：`.temp/qc-dayart-d1-visible.png`、`d2.png`、`d3.png`、`d4.png`、`d5.png`

---

## 2. SVG 內容跟當天行程有關？

**PASS（部分符合）**

- Day 1（北谷）：購物袋圖案 → 北谷美國村購物 ✓
- Day 2（浮潛）：海洋波浪 + 魚形 → 浮潛主題 ✓
- Day 3（水族館）：大型建築輪廓 + 魚 → 水族館 ✓
- Day 4（來客夢）：購物袋 + 汽車 → 來客夢購物中心 ✓
- Day 5（首里城）：城堡屋頂三角形 + 飛機起飛 → 首里城 + 回程 ✓

5 天 SVG 主題均與當天行程主題相符。

---

## 3. 切換行程 — 沖繩 vs 釜山，Day Header 裝飾不同？

**PASS**

沖繩 Day 1 SVG：`ellipse` + 波浪 `Q60 28 120 38` + 圓形 + 船帆
釜山 Day 1 SVG：波浪 `Q12 0 24 10` + `rect` + circle 點 + 飛機路徑 `M0 0 L-6 3 L-22 3`

兩者路徑完全不同，確認各行程有獨立 SVG。

截圖：`.temp/qc-dayart-okinawa-d1.png`（沖繩）、`.temp/qc-dayart-busan-d1.png`（釜山）

---

## 4. 板橋行程 — Day Header 有沒有顯示「橋」的圖案？

**PASS（已正確修正）**

板橋 Day 1 SVG 內容：
```svg
<circle cx="18" cy="18" r="14" stroke="#7A6A56" fill="none"/>
<line x1="18" y1="6" x2="18" y2="30" stroke="#E86A4A"/>
<line x1="6" y1="18" x2="30" y2="18" stroke="#7A6A56"/>
<circle cx="18" cy="18" r="2" fill="#E86A4A"/>
```

圓形 + 十字線 = **指南針/羅盤圖案**，不是橋的圖案。誤觸已修正。

截圖：`.temp/qc-dayart-banqiao-d1.png`

---

## 5. Dark mode — SVG 色彩和 opacity 有變？

**PASS（有降低）**

透過設定頁切換「深色 Dark」後：
- 背景色：`rgb(30, 26, 22)`（深色確認）
- Light mode SVG `<g opacity="0.18">`
- Dark mode SVG `<g opacity="0.15">`（略微降低）
- SVG 裝飾在深色背景下仍清晰可見，色彩對比正常

截圖：`.temp/qc-dayart-dark-okinawa.png`

---

## 6. DayNav pill 可讀性 — SVG 有沒有干擾標題文字？

**PASS**

- SVG `div[aria-hidden]` 為 `position: absolute; right: 0; top: 0; width: 80%; height: 100%`
- SVG `<g opacity="0.15~0.20">` 淡色不透明
- 標題「Day 1 北谷」、「Day 2 浮潛・瀨底」等文字清晰可讀
- 截圖目視確認：標題文字無被 SVG 遮擋

---

## 總結

| 項目 | 結果 | 備註 |
|------|------|------|
| 每天不同 SVG 裝飾 | PASS | 5 天各異 |
| SVG 內容與行程相關 | PASS | 全部 5 天主題符合 |
| 沖繩/釜山 SVG 不同 | PASS | 路徑完全不同 |
| 板橋無「橋」圖案 | PASS | 顯示指南針，已修正 |
| Dark mode opacity 降低 | PASS | 0.18→0.15 |
| 標題文字可讀性 | PASS | SVG 不干擾 |

**所有 6 項全數 PASS。**
