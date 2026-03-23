# QC Report v2 — SpeedDial 本機視覺驗證（post-ux-fixes-round2）

日期：2026-03-20  
測試環境：http://localhost:3000/?trip=okinawa-trip-2026-Ray  
測試工具：Playwright MCP（截圖優先）  

---

## 版本歷程

- **v1**（初版）：線上版 DOM 驗證，誤報 PASS
- **v2**（本機截圖重測）：發現左欄 icon 被右欄 label 覆蓋 — FAIL
- **v2 更新**（engineer 修正後重測）：左欄 icon 問題已修復，但右欄 label 超出畫面 — 部分修復

---

## 修正後重測結果（390×844 + 320×568）

### 截圖

- `local-v3-mobile-390-open.png`：390px，左欄 icon 可見，右欄 label 超出右側
- `local-v3-mobile-320-open.png`：320px，左欄 icon 可見，右欄 label 超出右側

---

## 1. 左欄 4 個 icon（航班/出發/緊急/備案）是否可見？

**PASS（已修復）**

390px 實測：
- 左欄 icon.x = 270，iconVisible = true
- 左欄 label.x = 202，labelRight = 252（在畫面內）
- 左欄 label 往左伸出，不再覆蓋左欄 icon

320px 實測：
- 左欄 icon.x = 200，iconVisible = true
- 左欄 label.x = 132，labelRight = 182（在畫面內）

---

## 2. 左欄 label 朝左、右欄 label 朝右？

**PASS（方向正確）**

CSS 實測：
- 左欄：`right: 52px`（往左），`left: -58px`
- 右欄：`left: 52px`（往右），`right: -58px`

方向邏輯正確。

---

## 3. 右欄 label 超出畫面右側 — FAIL（新問題）

**FAIL**

390px 實測：
- 右欄 label.x = 368，labelRight = 418 > viewport 390 → **超出 28px**

320px 實測：
- 右欄 label.x = 298，labelRight = 348 > viewport 320 → **超出 28px**

截圖可見右欄（建議/路線/交通/設定）label 被畫面右邊裁切，文字不完整顯示。

---

## 逐項驗證

| 項目 | 390×844 | 320×568 | 備註 |
|------|---------|---------|------|
| FAB ▲ icon | PASS | PASS | |
| 左欄 4 icon 可見 | PASS | PASS | 已修復 |
| 左欄 label 朝左 | PASS | PASS | `right: 52px` |
| 右欄 label 朝右 | PASS | PASS | `left: 52px` |
| 右欄 label 不超出畫面 | **FAIL** | **FAIL** | 超出 28px |
| 4×2 佈局 | PASS | PASS | |
| 8 個 item 全有 icon | PASS | PASS | |
| label 兩字 | PASS | PASS | |
| 字體 token | PASS | PASS | `var(--font-size-footnote)` |
| Stagger delay 1–8 | PASS | PASS | |
| 點擊觸發 sheet | PASS | PASS | |

---

## 建議修復

右欄 label 超出畫面問題，建議方案：

1. **SpeedDial container 往左移**：讓 grid 不緊靠右側邊緣，留足 label 空間
2. **右欄 label 改用 `right: 0` + 向上偏移**：避免橫向超出
3. **safe-area 加 label 寬度 padding**：在 `.speed-dial` container 加 `padding-right: calc(50px + env(safe-area-inset-right))`，讓整個 grid 往左偏移足夠空間
4. **限制 label 寬度並加 overflow:hidden**：最小侵入式修法，但會截斷文字

最推薦方案 3：調整 SpeedDial container 的右側偏移，讓右欄 label 有足夠空間不超出畫面。
