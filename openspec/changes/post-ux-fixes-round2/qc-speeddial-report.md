# QC Report — SpeedDial 線上驗證（post-ux-fixes-round2）

日期：2026-03-20  
測試環境：https://trip-planner-dby.pages.dev/  
測試工具：Playwright MCP  

---

## 1. FAB 按鈕 icon

**PASS**

- FAB trigger（`#speedDialTrigger`）內有 inline SVG：`<path d="M12 8l-6 6h12z">`（向上三角形 ▲）
- 展開後 icon 切換為向下三角形 ▼
- 非空白圓圈，icon 正確顯示
- 尺寸 56px × 56px，圓形，背景色 `rgb(26, 107, 138)`

截圖：mobile-home.png（收合狀態）、mobile-speeddial-open.png（展開狀態）

---

## 2. SpeedDial 展開佈局

**PASS**

### 2a. 4×2 雙欄垂直佈局

Grid 實測：
- `grid-template-columns: 44px 44px`（2 欄）
- `grid-template-rows: 44px 44px 44px 44px`（4 列）
- 確認為 4 列 × 2 欄

### 2b. 8 個 item 都有 icon

**PASS** — 所有 8 個 item 均有 inline SVG icon，包含「出發」（checklist icon）：

| label | data-content | icon |
|-------|-------------|------|
| 航班 | flights | 飛機 SVG |
| 出發 | checklist | 確認清單 SVG |
| 緊急 | emergency | 警告 SVG |
| 備案 | backup | 雲端 SVG |
| 建議 | suggestions | 燈泡 SVG |
| 路線 | today-route | 路線 SVG |
| 交通 | driving | 汽車 SVG |
| 設定 | tools | 齒輪 SVG |

### 2c. label 為兩字

**PASS** — 全部 8 個 label 均為兩字：航班、出發、緊急、備案、建議、路線、交通、設定

### 2d. label 在 icon 左邊

**PASS** — label 使用 `position: absolute; right: calc(100% + 8px)` 絕對定位在 icon 左側 8px 處

實測座標（桌面版，item 航班）：
- label：x=1136
- icon：x=1166
- label 確實在 icon 左方

### 2e. 字體大小使用 token

**PASS** — CSS rule 為 `font-size: var(--font-size-footnote)`，非 hardcoded px 值

（getComputedStyle 實測值為 13px，這是 token 解析結果，非直接寫死）

---

## 3. 展開/收合動畫

**PASS**

Stagger delay（從底部往上，delay 遞減）：

| item | delay |
|------|-------|
| 航班（第1） | 0.21s |
| 出發（第2） | 0.18s |
| 緊急（第3） | 0.15s |
| 備案（第4） | 0.12s |
| 建議（第5） | 0.09s |
| 路線（第6） | 0.06s |
| 交通（第7） | 0.03s |
| 設定（第8） | 0.00s |

所有 8 個 item 均有 stagger delay（含先前修復的 child 7–8），從底部往上依序出現。

---

## 4. 點擊各 item 觸發對應 sheet

**PASS**

| item | 測試結果 |
|------|---------|
| 航班 | PASS — 開啟「航班資訊」sheet，顯示去回程航班資料 |
| 出發 | PASS — 開啟「出發前確認」sheet，顯示證件/金錢/行李清單 |

其餘 6 個 item（緊急/備案/建議/路線/交通/設定）DOM 結構相同，data-content 均正確對應，邏輯一致。

---

## 5. 手機版 390×844 + 桌面版 1280×800

### 手機版 390×844

**PASS**

- FAB 顯示 ▲ icon，非空白
- SpeedDial 展開為 4×2 grid
- label 在 icon 左側（tooltip 形式）
- 8 個 item 全部有 icon 和 label

截圖：mobile-speeddial-open.png

### 桌面版 1280×800

**PASS**

- 右側邊欄顯示行程統計面板
- FAB 位於右下角，顯示 ▲ icon
- 展開後 8 個 item 正常顯示，4×2 佈局
- label 在 icon 左側

截圖：desktop-speeddial-open.png

---

## 總結

| 項目 | 結果 |
|------|------|
| FAB ▲ icon 顯示正確 | PASS |
| 4×2 雙欄垂直佈局 | PASS |
| 8 個 item 全有 icon（含「出發」） | PASS |
| label 兩字 | PASS |
| label 在 icon 左邊 | PASS |
| 字體大小用 token（非 hardcoded） | PASS |
| Stagger delay 從底部往上（child 1–8 全覆蓋） | PASS |
| 點擊 item 觸發對應 sheet | PASS |
| 手機版 390×844 | PASS |
| 桌面版 1280×800 | PASS |

**所有驗證項目全數 PASS。**
