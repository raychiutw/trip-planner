# QC Live Report — 線上網站驗證

**日期**：2026-03-20
**網站**：https://trip-planner-dby.pages.dev/
**環境**：手機 390×844 + 桌面 1280×800
**驗證行程**：okinawa-trip-2026-Ray（主要）、busan-trip-2026-CeliaDemyKathy（交通統計交叉驗證）

---

## Group A — 基本視覺修正

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| Day Header 無 border-left | `getComputedStyle` | PASS | `borderLeftWidth: 0px`，`borderLeftStyle: none` |
| 餐廳卡片無 border-left | 全頁掃描所有 `[class*="card"]` | PASS | 無任何元素有 border-left |
| DayNav pill 只顯示 MM/DD | DOM 文字檢查 | PASS | 非 active pill 顯示 `7/30`、`7/31` 等，無星期幾 |
| 頁面底部無白邊 | 捲到最底截圖 | PASS | 底部有 wave 裝飾，無多餘白邊 |

**截圖**：`qc-02-daynav-mobile.png`、`qc-03-bottom-mobile.png`、`qc-04-very-bottom-mobile.png`

---

## Group B — SpeedDial & DayNav 功能

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| SpeedDial 打開後是 2×4 grid | `getComputedStyle` + 截圖 | PASS | `.speed-dial-items` display:grid，gridTemplateColumns: 44px 44px（2欄），8個 items（2×4）|
| SpeedDial 每個 item 有 icon + label | DOM 結構檢查 | **PARTIAL FAIL** | 7/8 有 svg-icon；「出發確認」僅有 `<span class="speed-dial-label">` 無 icon |
| Active DayNav pill 下方有常駐 label | DOM 結構檢查 | PASS | `<button class="dn active">7/29<span class="dn-active-label">北谷</span></button>` 確認存在 |

**截圖**：`qc-05-speeddial-open.png`

**缺陷 B-1（FAIL）**：「出發確認」SpeedDial item 缺少 icon，`innerHTML` 只有 `<span class="speed-dial-label">出發確認</span>`，其餘 7 個 item 均有 `svg-icon`。

---

## Group C — 主題切換 & Bottom Sheet

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| Forest 主題 → ThemeArt SVG 顯示 | 截圖目測 | PASS | 綠色系配色 + 森林樹木 ThemeArt SVG 正確顯示 |
| Sakura 主題 → 截圖 | 截圖目測 | PASS | 粉紅色系 + 櫻花 ThemeArt SVG 正確顯示 |
| Ocean 主題 → 截圖 | 截圖目測 | PASS | 藍色系配色套用成功，ThemeArt SVG（帆船 + 海浪）正確顯示（第一輪誤判已更正）|
| Bottom Sheet 高度依內容（不撐滿螢幕） | `getBoundingClientRect` | PASS | `info-sheet-panel` 高度 396px（約 47% viewport），backdrop 全覆蓋為正常設計 |
| Bottom Sheet 開啟時背景不能捲動 | 嘗試 `window.scrollTo` | PASS | `scrollBefore === scrollAfter`，背景捲動被阻止 |

**截圖**：`qc-07-forest-theme.png`、`qc-08-sakura-theme.png`、`qc-09-ocean-theme.png`、`qc-10-flight-bottomsheet.png`

**觀察 C-1 已更正**：第二輪驗證確認 Ocean 主題（深海）Day Header 有 ThemeArt SVG（帆船 + 海浪圖案），顯示正常。第一輪誤判為不顯示，實為截圖角度問題。**全 6 個主題 ThemeArt SVG 均正常顯示。**

---

## Group D — Sticky Nav & Console 錯誤

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| Sticky nav 捲動時可見度 | 捲動後截圖 | PASS | position:sticky top:0，捲動後固定在頂部可見 |
| Console 無 Sentry CSP 違規錯誤 | `browser_console_messages(level:error)` | PASS | Total messages: 0（Errors: 0，Warnings: 0）|

**截圖**：`qc-11-sticky-nav-scroll.png`

---

## Group E — CSS 規則驗證

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| Sticky nav 無 border-bottom | `getComputedStyle` | PASS | `borderBottomWidth: 0px`，`borderBottomStyle: none` |
| 列印預覽模式下卡片無 border | 未測試（無法在 Playwright 中觸發真實列印預覽） | SKIP | 改由 CSS 原始碼審查覆蓋 |

---

## Group F — 交通統計驗證

| 項目 | 驗證方式 | 結果 | 說明 |
|------|---------|------|------|
| 交通統計顯示「Day 1」「Day 2」而非「Day undefined」（沖繩） | 截圖 + 目測 | PASS | 顯示「Day 1（7/29（三））：46 分鐘」「Day 2（7/30（四））：1 小時 30 分鐘」「Day 3（7/31（五））：1 小時 40 分鐘」 |
| 交通統計在釜山行程也正確 | 截圖 + 目測 | PASS | 顯示「Day 1（3/20（五））：1 小時 1 分鐘」「Day 2（3/21（六））：1 分鐘」「Day 3（3/22（日））：52 分鐘」 |

**截圖**：`qc-12-transport-stats.png`、`qc-13-transport-stats-day2.png`、`qc-14-busan-transport-stats.png`

---

## Group G — 全面異常掃描

| 項目 | 結果 | 說明 |
|------|------|------|
| Console errors | PASS | 手機版與桌面版均為 0 errors、0 warnings |
| 視覺跑版 | PASS | 桌面版雙欄佈局正常，手機版單欄正常，無元素溢出 |
| 功能異常 | PASS（1 項待確認） | SpeedDial「出發確認」缺 icon（見缺陷 B-1）|

**截圖**：`qc-15-desktop-okinawa.png`

---

## 桌面版補充驗證（1280×800）

| 項目 | 結果 | 說明 |
|------|------|------|
| Day Header 無 border-left | PASS | 0px |
| 所有卡片無 border-left | PASS | 全頁掃描無命中 |
| DayNav pill 無星期幾 | PASS | 非 active pill 純 MM/DD |
| Sticky nav 無 border-bottom | PASS | 0px |
| 雙欄面板佈局 | PASS | 左側行程 + 右側「今日行程/行程統計」面板正常顯示 |

---

## 彙總

| Group | 狀態 | 備註 |
|-------|------|------|
| A — 基本視覺修正 | PASS | |
| B — SpeedDial & DayNav | PARTIAL FAIL | 「出發確認」缺 icon |
| C — 主題切換 & Bottom Sheet | PASS | 全 6 主題 ThemeArt SVG 均正常（Ocean 誤判已更正）|
| D — Sticky Nav & Console | PASS | |
| E — CSS 規則 | PASS（列印未測） | |
| F — 交通統計 | PASS | 沖繩 + 釜山均正確 |
| G — 全面掃描 | PASS | |

### 需要工程師處理的項目

| 優先 | 問題 | 位置 |
|------|------|------|
| MEDIUM | 「出發確認」SpeedDial item 缺少 SVG icon | SpeedDial 元件，速查對應的 icon key |
~~| LOW | Ocean 主題 Day Header 無 ThemeArt SVG | 確認是設計意圖還是遺漏 |~~ （已更正，Ocean 主題 ThemeArt 正常）

---

## 第二輪 — Key User 回報問題深入驗證

### KU-1：缺圖（ThemeArt SVG）

逐一切換全 6 個主題，截圖確認 Day Header ThemeArt SVG：

| 主題 | ThemeArt 內容 | 結果 |
|------|--------------|------|
| 陽光 Sunshine | 棕櫚樹 + 太陽 | PASS（截圖：qc-theme-sunshine-header.png）|
| 晴空 Clear Sky | 熱氣球 | PASS（截圖：qc-theme-clearsky-header.png）|
| 和風 Japanese Zen | 鳥居 + 花枝 | PASS（截圖：qc-theme-wabi-header.png）|
| 森林 Deep Forest | 森林樹木 | PASS（截圖：qc-07-forest-theme.png）|
| 櫻花 Cherry Blossom | 櫻花樹 | PASS（截圖：qc-08-sakura-theme.png）|
| 深海 Deep Ocean | 帆船 + 海浪 | PASS（截圖：qc-theme-ocean-header-detail.png）|

頁面底部 wave/footer 裝飾：各主題底部均有對應顏色的 wave 裝飾（截圖：qc-t2-bottom-footer.png）。

**KU-1 總結：PASS — 全 6 個主題 ThemeArt SVG 均正常顯示。**

---

### KU-2：文字太小太擠

測量結果：

| 元素 | 字體大小 | lineHeight | 評估 |
|------|---------|------------|------|
| body | 17px | 25.5px（1.5×）| 正常 |
| Day Header（h2） | 22px | 33px | 正常 |
| DayNav pill（.dn） | 13px | normal | 偏小但功能正常 |
| DayNav active-label | 12px | normal | 可接受 |
| SpeedDial item | 13.3px | normal | 偏小 |
| **SpeedDial label（.speed-dial-label）** | **11px** | normal | **偏小，可能影響可讀性** |
| weather bar | 17px | 25.5px | 正常 |
| travel info | 17px | 25.5px | 正常 |

DayNav pill 量測：
- 各 pill 寬度 44~52px，padding left/right 各 12px
- active pill（7/29）寬 52px，active-label（「北谷」）位於 pill 框下方，但仍在 sticky-nav 容器內（navBottom:96，labelBottom:81），未被裁切
- 視覺上可見（截圖：qc-t5-daynav-active-label.png）

**KU-2 總結：PARTIAL CONCERN — SpeedDial label 字體 11px 偏小；DayNav pill 與 active-label 功能完整，active-label 未被截斷。主要內容文字（17px/1.5x）正常。**

---

### KU-3：操作不正常

| 操作 | 測試方式 | 結果 | 說明 |
|------|---------|------|------|
| Bottom Sheet 開啟 | 點擊「航班」quick-link button | PASS | Sheet 正常開啟（截圖：qc-t6-sheet-open.png）|
| Bottom Sheet 關閉（X 按鈕） | 點擊 `.sheet-close-btn` | PASS | Sheet 關閉，transform 滑出（translateY 140px）|
| SpeedDial 觸發 sheet | 點擊 SpeedDial 「航班資訊」item | PASS | 正確開啟航班資訊 sheet（截圖：qc-t8-speeddial-trigger-sheet.png）|
| DayNav 切換天 | 點擊 7/30 pill | PASS | 成功切換到 Day 2，active pill 更新，URL hash 更新為 #day2（截圖：qc-t9-day2-switch.png）|
| Bottom Sheet 背景捲動防止 | 嘗試 window.scrollTo | PASS | 背景捲動被阻止 |
| 手勢（到頂→縮小） | Playwright 無法模擬真實 touch gesture | SKIP | 需要真機測試 |

**KU-3 總結：PASS（手勢功能需真機驗證，Playwright 無法模擬）。**

---

---

### KU 追加：FAB trigger icon 缺失

| 項目 | DOM 結構 | CSS 偽元素 | backgroundImage | 結果 |
|------|---------|-----------|----------------|------|
| `.speed-dial-trigger` | `innerHTML: ""` | `::before/::after content: none` | `none` | **FAIL** |

- FAB trigger（56×56px 圓形按鈕）內部完全空白，無三角形 icon 或任何視覺元素
- `aria-label="快速選單"` 存在，功能可觸發，但視覺上是純色圓圈
- 截圖確認：`qc-fab-trigger-closed.png`、`qc-fab-trigger-open.png`

---

## 最終缺陷清單（更新後）

| 優先 | 問題 | 詳情 |
|------|------|------|
| **HIGH** | **FAB SpeedDial trigger 無 icon** | `innerHTML` 空白，`::before`/`::after` content 均為 none，按鈕為純色圓圈，無三角形或任何圖示 |
| MEDIUM | 「出發確認」SpeedDial item 缺 SVG icon | innerHTML 只有 `<span class="speed-dial-label">出發確認</span>`，其餘 7 個均有 svg-icon |
| LOW-CONCERN | SpeedDial label 字體 11px 偏小 | Key User 反映「文字太小」，11px 在小尺寸手機上可能難以閱讀，建議評估調整至 12px |
