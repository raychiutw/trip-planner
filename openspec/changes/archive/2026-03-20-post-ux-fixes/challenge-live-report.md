# Challenge Live Report — 2026-03-20 Post-UX Fixes

**Challenger**: Live site audit via Playwright
**Target**: https://trip-planner-dby.pages.dev/
**Trip tested**: okinawa-trip-2026-Ray
**Viewport**: 390x844 (iPhone 14 Pro) + desktop responsive

---

## UX 視角

### #1 Day Header + 餐廳卡片 border-left 移除後視覺層級

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: Day Header (`border-left: 0px none`)、timeline cards (`.tl-card`)、restaurant cards (`.info-box.restaurants`) 全部確認無 border-left。視覺層級透過背景色差異（Day Header 使用 `rgb(216, 238, 245)` ocean 主題色）與間距維持，層級區分清楚。
- **截圖**: challenge-live-09-day2-header.png, challenge-live-08-restaurant-card.png

### #2 SpeedDial 2x4 grid 手機上是否太擠

- **嚴重度**: 🟡 中
- **結果**: 有疑慮
- **證據**: SpeedDial 展開後為 2 欄 x 4 列 grid（`grid-template-columns: 44px 44px`，gap: 12px），8 個按鈕同時顯示。每個按鈕 44px 寬含圖示 + 文字標籤。Grid 容器寬度 100px、高度 276px，佔螢幕右下角。
- **問題**: 8 個功能同時出現（航班資訊、出發確認、緊急聯絡、備案、AI 建議、今日路線、交通統計、設定），新用戶可能需要時間辨識。但按鈕都有清楚的圖示 + 文字標籤，且 44px touch target 符合 WCAG 最小觸控區域要求。
- **建議**: 可考慮分群或減少按鈕數量，但目前可接受。
- **截圖**: challenge-live-05-speeddial-grid-only.png

### #3 DayNav active pill 下方常駐 label

- **嚴重度**: 🟡 中
- **結果**: 功能存在但可見性受限
- **證據**: Active label 存在（`.dn-active-label`，text: "北谷"），CSS 屬性：`display: block, visibility: visible, opacity: 1, position: absolute, font-size: 12px, overflow: hidden, text-overflow: ellipsis, max-width: 120px`。
- **問題**: Label rect (top:64, bottom:81) 位於 grandparent `.dh-nav` (bottom:64, `overflow: auto`) 正下方。Label 在 `.sticky-nav` (bottom:96) 範圍內。parent `.dn.active` 有 `overflow: visible` 允許溢出。在截圖中 label 非常不顯眼——12px 字體、與 pill 之間無明顯視覺連結。
- **建議**: 可考慮加大字體或加深顏色以提高可見性。
- **截圖**: challenge-live-10-daynav-label.png

---

## 相容性視角

### #4 6 主題 ThemeArt SVG 顯示

- **嚴重度**: 🟡 中
- **結果**: SVG 顯示正常但無主題差異化
- **證據**: 6 個主題（default, forest, sakura, ocean, sunset, night）全部顯示 ThemeArt SVG，`opacity: 1`，可見。但所有 6 個主題使用完全相同的 SVG（viewBox `0 -10 200 100`，4 個子元素，outerHTML 長度 1331 bytes）。SVG 使用硬編碼顏色（`#F47B5E`, `#8B6914`, `#2D8A2D` 等），不使用 CSS variables 或 currentColor。
- **問題**: 切換主題後 ThemeArt 顏色不隨主題變化。Proposal #1 提及 "3 主題 x 6+ SVG 未實作" 屬 Group C 大型任務，可能仍在進行中。此外，5 個 Day Header 也使用完全相同的 SVG，無法區分不同天的特色。
- **建議**: 確認 Group C 工作範圍——ThemeArt 是否計劃實作主題/天數差異化。
- **截圖**: challenge-live-11-theme-forest.png, challenge-live-12-theme-sakura.png, challenge-live-13-theme-sunset.png, challenge-live-14-theme-night.png

### #5 Bottom Sheet 動態高度

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: `.info-sheet-panel` max-height 為 680px（viewport 844px 的 80.6%），符合 "max 85%" 要求。Panel 使用 `position: fixed, bottom: 0`，transition 包含 `height 0.35s` 動畫。關閉時 `transform: translateY(140)` 隱藏面板。

---

## 效能視角

### #6 頁面載入速度

- **嚴重度**: 🟢 低
- **結果**: PASS — 效能優秀
- **證據**:
  - DOM Interactive: 67ms
  - DOMContentLoaded: 143ms
  - Load Complete: 160ms
  - Total Transfer: 34KB
  - JS files: 4 (1KB), CSS files: 2 (1KB)
  - Resources: 32 total, 0 external SVG requests（全部 inline）
- **399 inline SVGs** 在 DOM 中（309 icon SVG + 5 ThemeArt + 85 other），未造成明顯效能影響。

### #7 Console 錯誤/警告

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: Console errors: 0, warnings: 0。頁面載入乾淨無錯誤。

---

## 資安視角

### #8 CSP 設定

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: CSP meta tag 已設定：
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.open-meteo.com https://*.ingest.us.sentry.io;
  img-src 'self' https: data:;
  ```
  Sentry domain (`https://*.ingest.us.sentry.io`) 已加入 `connect-src`，修復 #7 CSP 問題。

### #9 敏感資訊洩漏

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: 掃描 HTML 原始碼：無 API key、token、password、secret、私有 IP、email 洩漏。Meta tags 僅含公開的 OG 資訊。

---

## 無障礙視角

### #10 SpeedDial trigger aria-controls

- **嚴重度**: 🟢 低
- **結果**: PASS
- **證據**: SpeedDial trigger button 具備完整無障礙屬性：
  - `aria-controls="speedDialItems"` — 關聯到 items 容器
  - `aria-expanded="false"` / `"true"` — 正確反映展開狀態
  - `aria-label="快速選單"` — 清楚的操作說明
  - 所有 8 個 speed-dial-item 都有 `aria-label`（航班資訊、出發確認、緊急聯絡等）

### #11 DayNav tooltip aria-describedby

- **嚴重度**: 🟡 中
- **結果**: FAIL — 缺少無障礙屬性
- **證據**: 5 個 DayNav pill buttons 全部缺少：
  - `aria-label`: null（active pill 的文字是 "7/29北谷" 含 label，但非 active pills 只有日期如 "7/30"，無地點資訊）
  - `aria-describedby`: null
  - `title`: null
  - `role`: null（使用 `<button>` 所以 implicit role 是 button，可接受）
  - 無 tooltip 元素存在於 DOM 中（`[role="tooltip"]` 查詢結果為空）
- **問題**: 螢幕閱讀器用戶點到非 active 的 pill 只會聽到 "7/30 按鈕"，不知道該天的行程地點（如 "浮潛・瀨底"）。需要 `aria-label="7/30 浮潛・瀨底"` 或 tooltip + `aria-describedby` 來傳達完整資訊。
- **建議**: 為每個 DayNav pill 加上 `aria-label` 包含日期 + 地點名稱。

---

## 總結

| 嚴重度 | 數量 | 項目 |
|--------|------|------|
| 🔴 高 | 0 | — |
| 🟡 中 | 4 | #2 SpeedDial 8 按鈕認知負擔、#3 Active label 可見性低、#4 ThemeArt 無主題差異化、#11 DayNav 缺 aria-label |
| 🟢 低 | 7 | #1 border-left 移除 OK、#5 Bottom Sheet OK、#6 效能優秀、#7 Console 乾淨、#8 CSP OK、#9 無洩漏、#10 SpeedDial a11y OK |

**整體評價**: 14 項修復中大部分已正確反映在線上版本。無 🔴 高嚴重度問題。4 個 🟡 中等問題中，#4 ThemeArt 屬 Group C 範疇可能仍在進行中，#11 DayNav aria-label 是應修復的無障礙缺失，#2 和 #3 為 UX 優化建議。

---

## 補充：Key User 回饋專項深度質疑

### KU-1 ThemeArt SVG 是否真的渲染了？

- **嚴重度**: 🔴 高（Key User 直接回饋）
- **結果**: SVG 有渲染，但 6 主題 x 5 天 = 30 個 SVG 全部完全相同
- **深入證據**:
  - 每個 Day Header 確實有 1 個 SVG，viewBox `0 -10 200 100`，15 個子元素，全部 `visible=true`，渲染尺寸 304x100px
  - SVG 內容是「燈塔 + 海浪」圖案（path 波浪線 + rect 燈塔建築 + 圓形燈光）
  - 6 個主題切換後，SVG 的 fill/stroke 顏色完全相同：`#C0C8D0`、`#1A6B8A`、`#C04030`、`#2A8EB0`、`#8B6040`（全是 ocean 風格色系）
  - SVG 使用硬編碼 hex 色值，無 CSS variables、無 currentColor
  - `.dh-art` 容器不存在（`querySelector('.dh-art')` 回傳 null），SVG 直接內嵌在 `.day-header` 中
  - 5 天的 SVG outerHTML 長度完全一致（1307 bytes）
- **結論**: Proposal #1 提到「3 主題 x 6+ SVG 未實作」的 Group C 任務，目前只實作了 1 種 ocean 風格 SVG，且未依主題/天數差異化。Key User 看到的「缺圖」可能是指 forest 主題下出現海洋風格圖案的違和感。
- **截圖**: challenge-live-11-theme-forest.png（forest 主題下仍是海洋燈塔圖）

### KU-2 SpeedDial label 是否太小不可讀？

- **嚴重度**: 🔴 高（Key User 直接回饋）
- **結果**: 確認字體過小，且有缺 icon 問題
- **精確測量**:
  - Label font-size: **11px**（iOS Human Interface Guidelines 建議最小可讀字體為 11pt，但 11px < 11pt）
  - 每個按鈕尺寸: 44x60px（icon 24x24 + label + 8px/4px padding）
  - 4 字標籤（航班資訊、緊急聯絡、今日路線、交通統計）寬度 = 44px = 按鈕寬度的 **100%**，零 margin
  - 2 字標籤（備案、設定）只有 22px 寬，視覺上偏離中心感較弱
  - Grid gap: 12px，grid 總寬度 100px（佔螢幕 26%），高度 276px（佔螢幕 33%）
  - **「出發確認」按鈕缺少 icon**（`iconSize: null`），只有文字標籤，與其他 7 個有 icon 的按鈕不一致
- **結論**: 11px label 在手機上偏小但尚可辨識，真正的問題是「出發確認」缺 icon 和 4 字標籤無 margin 的擁擠感。
- **截圖**: challenge-live-17-speeddial-grid-clean.png

### KU-3 InfoSheet 手勢引擎是否造成操作異常？

- **嚴重度**: 🟡 中（Playwright 無法完整模擬觸控手勢）
- **結果**: 基本操作正常，但有潛在 overscroll 風險
- **測試結果**:
  - **Scroll lock**: PASS — 開啟 sheet 時 `body.position: fixed` + `body.top: -1.33px` 鎖定背景捲動
  - **Sheet 內容捲動**: PASS — `.info-sheet-body` overflow: auto，scrollHeight 2124 > clientHeight 577，可正常捲動
  - **關閉後恢復**: PASS — 關閉 sheet 後 body 恢復 `position: static`，scroll position 基本恢復（1.33px 偏移）
  - **動態高度**: PASS — panel maxHeight 717.4px（viewport 的 85%），依內容自適應
  - **Sheet handle 拖曳**: 無法在 Playwright 中模擬觸控拖曳，需實機測試
- **潛在問題**:
  - `.info-sheet-body` 的 `overscroll-behavior: auto`（預設值）——捲到 sheet 頂/底時，overscroll 可能穿透到 body。建議設為 `overscroll-behavior: contain`
  - `touch-action: auto` 未限制——在拖曳 sheet handle 時可能與內容捲動衝突（Proposal #11 提到的問題）
  - `.dragging` CSS class 已有定義（之前修復），但無法在 Playwright 測試實際拖曳行為
- **限制聲明**: Playwright 無法模擬 iOS Safari 的觸控手勢、rubber-banding、慣性捲動。Key User 報告的「操作不正常」需在實際 iOS 裝置上驗證。
- **截圖**: challenge-live-19-sheet-open-scrolllock.png

---

### KU-4 SpeedDial trigger icon 消失（F.3 regression）

- **嚴重度**: 🔴 高（Key User 直接回報 + 確認為 regression）
- **結果**: FAB trigger 按鈕完全沒有 icon，只有純色圓形
- **根因分析**:
  1. F.3 修復將 SpeedDial trigger 的 hardcoded `<path d="M12 8l-6 6h12z" />` 改為 `<Icon name="expand_less" />`（`SpeedDial.tsx:134`）
  2. `expand_less` **不存在於 Icon registry**（`src/components/shared/Icon.tsx` 的 ICONS 物件，共 84 個 icon，無 `expand_less`）
  3. Icon component 找不到 name 時 return null（`Icon.tsx:92: if (!pathData) return null`）
  4. 結果：trigger `innerHTML` 為空字串，按鈕渲染為 56x56px 純色圓形（`background-color: rgb(26, 107, 138), border-radius: 50%`）
  5. 無 CSS pseudo-element、無 background-image、無任何視覺提示
- **影響**: 使用者看到頁面右下角一個無 icon 的圓形按鈕，無法辨識這是快速選單觸發器。`aria-label="快速選單"` 只對螢幕閱讀器有效。
- **修復建議**: 將 `expand_less` 加入 ICONS registry，或改回 hardcoded path
- **截圖**: challenge-live-10-daynav-label.png（右下角可見空白圓形 FAB）

---

## 更新總結

| 嚴重度 | 數量 | 項目 |
|--------|------|------|
| 🔴 高 | 3 | KU-1 ThemeArt 6 主題共用同一 SVG、KU-2 SpeedDial 11px label + 出發確認缺 icon、**KU-4 FAB trigger icon 消失（F.3 regression — `expand_less` 不在 icon registry）** |
| 🟡 中 | 5 | #2 SpeedDial 認知負擔、#3 Active label 可見性低、KU-3 InfoSheet overscroll-behavior 未設 contain、#4 ThemeArt 無天數差異化、#11 DayNav 缺 aria-label |
| 🟢 低 | 7 | #1 border-left OK、#5 Bottom Sheet OK、#6 效能優秀、#7 Console 乾淨、#8 CSP OK、#9 無洩漏、#10 SpeedDial a11y OK |
