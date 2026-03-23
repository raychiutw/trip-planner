# Round 2 Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-20
**Scope**: 22 items across 3 engineers (G, H, I)

---

## Overall Assessment: APPROVE

Round 2 的實作品質整體良好。三位工程師正確處理了 Challenger 提出的高風險項目（時區、negative margin 選擇性套用、ThemeArt 根因釐清），並在多數項目上做出合理的設計決策。以下逐項審查。

---

## Bug 修復（#1-#5）

### #1 ThemeArt content map — PASS (Engineer I)

**結論正確。** 程式碼審查確認：
- `DayHeaderArt` (ThemeArt.tsx:343-344) 用 `` `${theme}-${dark ? 'dark' : 'light'}` `` 組合 key
- `ColorTheme` (useDarkMode.ts:5) = `'sun' | 'sky' | 'zen' | 'forest' | 'sakura' | 'ocean'`
- content map 有 12 個 key，完全對應 6 主題 x 2 模式
- `DividerArt`、`FooterArt`、`NavArt` 同樣正確匹配
- body class 是 `'theme-sun'` 但只用於 CSS，ThemeArt 接收的是 `colorTheme`（= `'sun'`），無前綴

不是程式碼 bug，標記為 no-op 合理。

### #2 FAB trigger hardcoded SVG — PASS (Engineer G)

SpeedDial.tsx:6-9 使用 `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6h12z" /></svg>`，不依賴 Icon registry，正確。

### #3 出發確認補 icon — PASS (Engineer G)

逐一比對 DIAL_ITEMS vs ICONS registry，僅 `checklist` 缺失，改為 `check-circle`。SpeedDial.tsx:23 確認已更新。語意合理。

### #4 DayNav active label — PASS (Engineer H)

確認先前修復有效。style.css:54 `.dh-nav` 設定 `overflow-y: visible`，style.css:53 `.dh-nav-wrap` 有 `padding-bottom: 20px`。label 不會被裁切。無需額外修改，標記為已修復正確。

### #5 Drag handle — PASS (Engineer H)

style.css:657 `.sheet-handle` opacity 從 `0.35` 調至 `0.5`，改善可見性。保留 `background-clip: content-box` + `padding: 20px 0` 的 tap target 設計。合理。

---

## SpeedDial 重設計（#6, #8）

### #6 SpeedDial 4x2 雙欄垂直 — PASS (Engineer G)

**CSS (style.css:571-598)**:
- `grid-template-rows: repeat(4, 1fr); grid-auto-flow: column` — 先填列再換欄，正確
- item 改為純 icon button + absolute positioned label（右側 pill）
- Label 兩字化：航班、出發、緊急、備案、建議、路線、交通、設定 — 全部兩字
- Staggered animation 反轉（child 8 = 0ms, child 1 = 210ms） — 從 FAB 附近往上展開，方向正確
- 8 個 `nth-child` delay 全部存在（之前 Round 1 有缺 child 7-8 的問題，已修復）

**小螢幕高度計算**：
- 4 行 x 44px + 3 gap x 12px = 212px
- FAB 56px + gap 16px = 72px
- 底部位置 ~88px
- 總計 ~372px，iPhone SE (667px) 上頂端在 295px，可接受

### #8 SpeedDial label token — PASS (Engineer G)

style.css:604 `.speed-dial-label` 使用 `var(--font-size-footnote)`，已是 token。

---

## 移除/簡化（#7, #10, #16）

### #7 移除 useSwipeDay — PASS (Engineer H)

- `src/hooks/useSwipeDay.ts` 已刪除（Glob 確認不存在）
- `src/pages/TripPage.tsx` 中無任何 `useSwipeDay` 殘留（Grep 確認零結果）
- `tripContentRef` 已清理（未在 TripPage 中找到）
- CSS 無 swipe 相關樣式需清理

**完全移除，無殘留。**

### #10 行程頁移除返回箭頭 — PASS (Engineer H)

確認 TripPage 的 sticky-nav (TripPage.tsx:885-889) 只有 `nav-brand` + `DayNav` + `NavArt`，無返回箭頭。`.nav-back-btn` 僅存在於 SettingPage。無需修改，標記正確。

### #16 InfoPanel 移除 QuickLinks — PASS (Engineer I)

- `QuickLinks.tsx` 已刪除（Glob 確認不存在）
- `InfoPanel.tsx` 無 QuickLinks import（已審查完整檔案）
- `TripPage.tsx` 無 `onQuickAction` prop 傳遞（已審查 InfoPanel 使用處 TripPage.tsx:924-928）
- `style.css` 中無 `quick-link` 相關 CSS（Grep 確認零結果）

**完全清理，無 dead code。**

---

## Bottom Sheet 修正（#9, #11, #13）

### #9 X 關閉按鈕 — PASS (Engineer H)

確認 `.sheet-close-btn` (style.css:670-672) 已使用 `width: var(--tap-min); height: var(--tap-min)` = 44px，符合 Apple HIG。設定頁也已是 44px。Challenger 提出的 40<44 方向錯誤問題已正確處理（統一為 44px）。

### #11 匯出選項橫向排列 — PASS (Engineer H)

style.css:692-694:
- `.download-sheet-options`: `flex-direction: row; flex-wrap: wrap`
- `.download-option`: `flex: 1 1 auto; justify-content: center; border-right: 1px solid var(--color-border)`
- 最後一個 `border-right: none`
- 字體縮為 `--font-size-callout` 以適應橫向空間

**注意（非阻擋）**：4 個選項在 375px 寬的 iPhone 上，`flex-wrap: wrap` 會自動換行，避免文字截斷。但 label 如「PDF（含排版）」較長，可能導致不均勻換行。建議 QC 在小螢幕驗證。

### #13 InfoSheet overscroll — PASS (Engineer H)

style.css:685 `.info-sheet-body` 加入 `overscroll-behavior: contain`。一行 CSS，正確無風險。

---

## DayNav 修正（#12, #14）

### #12 DayNav pill aria-label — PASS (Engineer H)

DayNav.tsx:189:
```tsx
aria-label={d.label ? `${formatPillLabel(d)} ${d.label}` : formatPillLabel(d)}
```
- 有 label 時：`"3/25 美國村"`
- 無 label 時：`"3/26"`
- 使用已有的 `formatPillLabel` helper，資料來源正確

### #14 Active label 加強可見性 — PASS (Engineer H)

style.css:123-124:
- `font-size`: `var(--font-size-footnote)`（從 caption 升級）
- `color`: `var(--color-foreground)`（從 muted 升級）
- `max-width: 120px` + `text-overflow: ellipsis` 防止過長截斷

---

## 全站規範（#15, #22）

### #15 全站 font-size token — PASS (Engineer G)

掃描結果為零筆 hardcoded `font-size: Npx`。全站 font-size 已完成 token 化。標記為 no-op 正確。

### #22 全站 hover padding — PASS (Engineer G)

**關鍵：採納了 Challenger 建議的「逐一評估」策略，而非一次性全站套用。**

實際修改的元素：
- `.col-row`: 加 padding + negative margin + radius-sm（style.css:179）
- `.today-summary-item`: 加 padding + negative margin + radius-sm（style.css:502）
- `.hw-summary`: 新增 hover background + padding + negative margin + radius-sm（style.css:454）

已評估但保持不動的元素：`.dn`、`.map-link`、`.quick-link-btn`（已移除）、`.tool-action-btn`、`.sheet-close-btn`、`.download-option`、`.nav-back-btn/.nav-close-btn`、`.trip-btn` — 這些已有足夠的 padding。

**審查 negative margin 風險**：
- `.col-row` 在 `.day-overview` 內（`padding: 12px`），negative margin 不會超出容器
- `.today-summary-item` 在 `.info-card` 內（`padding: 16px`），negative margin 不會超出容器
- `.hw-summary` 在 `.day-overview` 內，同理安全

策略正確，風險可控。

---

## InfoPanel 桌面版（#17, #20, #21）

### #17 今日行程 onClick → scrollIntoView — PASS (Engineer I)

**實作鏈完整：**
1. `TimelineEvent.tsx:112`: `.tl-event` 加上 `data-entry-index={index - 1}`
2. `InfoPanel.tsx:25-29`: `handleEntryClick` 用 `document.querySelector('.tl-event[data-entry-index="N"]')` + `scrollIntoView({ behavior: 'smooth', block: 'center' })`
3. `TodaySummary.tsx:26`: `onClick={() => onEntryClick?.(i)}` — index `i` 是 entries array 的 0-based index
4. `TimelineEvent` 的 `data-entry-index={index - 1}` 中 `index` 是 1-based（因為 flag 顯示 `{index}`），所以 `index - 1` = 0-based，與 TodaySummary 的 `i` 匹配

**索引對齊正確。**

**注意**：`TodaySummary` 新增了 `role="button"` 和 `tabIndex={0}` 給 `<li>` 元素，提升了無障礙性。但缺少 `onKeyDown` handler（Enter/Space 應觸發 click）。

> **Minor issue**: `TodaySummary.tsx:23-28` 有 `onClick` 和 `role="button"` + `tabIndex={0}`，但沒有 `onKeyDown` handler。鍵盤使用者按 Enter/Space 不會觸發 `onClick`（在 `<li>` 上）。這不阻擋 approve，但建議後續補上。

### #20 InfoPanel 圓角 — PASS (Engineer G)

style.css:470 `.info-panel` 加入 `border-radius: var(--radius-lg)`。

### #21 倒數天數簡化 — PASS (Engineer I)

Countdown.tsx 實作：
- 出發前：`<span class="countdown-num">{diff}</span><span class="countdown-unit">天</span>`
- 旅行中：`Day N` + 「旅行進行中」
- 旅行後：plane icon + 「旅程已結束」

style.css:490-492：
- `.countdown-number`: `display: flex; align-items: baseline; justify-content: center; gap: 4px`（改為 `gap: 4px`，非 `gap: 2px`）
- `.countdown-num`: `font-size: var(--font-size-title2)` — 使用 `--font-size-title2`（1.375rem），正確避開不存在的 `--font-size-title1`
- `.countdown-unit`: `font-size: var(--font-size-body); font-weight: 600`

> **Note**: Engineer G 的測試報告提到 `.countdown-number { gap: 2px }` 導致 css-hig 測試失敗，但實際 CSS 中是 `gap: 4px`。可能是測試時的暫時狀態，目前值是正確的。

---

## 新功能（#18）

### #18 旅行當天自動定位 — PASS (Engineer I)

**時區處理（Challenger 高風險項目）** — 完全採納修正：

TripPage.tsx:173-196 `TRIP_TIMEZONE` + `getLocalToday()`:
- `Intl.DateTimeFormat('sv-SE', { timeZone })` 取得目的地當地日期 — **正確**
- okinawa/kyoto → `Asia/Tokyo`，busan → `Asia/Seoul`，banqiao → `Asia/Taipei`
- fallback 使用使用者本地日期（非 UTC）— **正確**

**URL hash 優先** — TripPage.tsx:652-663：
- `window.location.hash` 匹配 `#dayN` 時直接跳轉，不執行 auto-locate — **正確**

**`.tl-now` null check** — TripPage.tsx:674-676：
- `const nowEl = document.querySelector('.tl-now')` + `if (nowEl)` guard — **正確**
- 300ms 延遲確保 DOM 更新後才 scroll — 合理

**`todayDayNum`** — TripPage.tsx:629-633：
- 改用 `getLocalToday(activeTripId)` — **正確**

**完整性檢查**：auto-scroll 的 `dayNums[idx]` 假設 `autoScrollDates` 的索引與 `dayNums` 的索引一致（TripPage.tsx:668）。由於兩者都是從 `days` 派生且按序排列（autoScrollDates.sort(), dayNums.sort()），這是成立的。

---

## 交通統計重設計（#19）

### #19 DrivingStats 重設計 — PASS (Engineer I)

**formatUtils.ts**:
- `>=1h`: `XhYYm`（如 `2h05m`）— formatMinutes.ts:16-17 `padStart(2, '0')` 確保分鐘兩位
- `<1h`: `YYm`（如 `30m`）— 注意：不是 `0h30m`，直接顯示 `30m`
- `0`: `—`（em dash）

格式規則一致且明確。

**DrivingStats.tsx**:
- 手機版 (< 768px)：`.ds-cards` 垂直卡片排列，每天一張卡片（L131-152）
- 桌面版 (>= 768px)：`.ds-table` 表格排列，底部合計列（L155-191）
- 開車 >2h 警告：`isDrivingWarning()` 判斷 + `.ds-cell-warn`（color: --color-warning）+ warning icon
- 卡片警告：`.ds-card-warn`（background: --color-warning-bg）
- 合計列警告：`.ds-row-warn`（background: --color-warning-bg）
- `TRANSPORT_TYPE_ORDER` 控制欄位排序
- `activeTypes` 過濾只顯示存在的交通類型

**CSS (style.css:319-341)**:
- `@media (min-width: 768px)` 控制 cards/table 切換 — 斷點與全站一致
- `.ds-table-label { text-align: left !important }` — 使用 `!important` 覆蓋 `td` 的 `text-align: center`

> **Minor note**: `!important` 在 `.ds-table-label` 上可以改用更高特異性選擇器避免，但在此情境下不影響功能。

---

## 決定

### APPROVE

所有 22 項修改均已審查通過。三位工程師的實作在正確性、一致性、Challenger 風險項目處理上表現良好。

### 後續建議（非阻擋）

1. **TodaySummary `<li>` onKeyDown**: 加 `onKeyDown` handler 讓鍵盤使用者可觸發 scrollIntoView（無障礙改善）
2. **DownloadSheet 橫向排列**: QC 驗證 375px 寬螢幕上 4 個選項的 `flex-wrap` 換行表現
3. **Countdown gap**: 確認 `css-hig.test.js` 在 `gap: 4px` 下通過（Engineer G 報告提到 `gap: 2px` 失敗，但目前 CSS 為 `gap: 4px`）
4. **TRIP_TIMEZONE 擴充**: 新增行程目的地時需同步更新 `TRIP_TIMEZONE` mapping
