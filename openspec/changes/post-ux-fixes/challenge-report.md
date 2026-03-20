# Challenge Report — post-ux-fixes (Full: Group A+B+E+F+G)

審查日期：2026-03-20（第二輪，涵蓋全部修改）
Challenger 審查範圍：Engineer A 報告（Group A + E）、Engineer C 報告（Group F + G）

---

## Part 1: Group A+B 修改質疑（保留自第一輪，15 項）

### 1. [#11 UX] 移除 border-left 後的視覺層級（A.1-A.3）

- **問題**：`.day-header`、`.restaurant-choice`、`.hotel-sub` 的 `border-left` 全部移除。Day Header 改靠背景色區分（light: `--color-accent-subtle` + gradient / dark: `--color-accent-bg` + gradient），餐廳卡片靠 `--color-accent-subtle` 背景。`.hotel-sub` 現在只剩 `padding: 4px 0 4px 16px`，沒有任何視覺指示來標示它是子層級。在 6 套主題 x light/dark 共 12 種組合下，`--color-accent-subtle` 與 `--color-secondary` 的對比度是否都足夠？
- **嚴重度**：🟡中
- **建議**：QC 截圖驗證全部 12 種主題組合。若對比不足，可用 subtle box-shadow 補償。

### 2. [#8 相容性] safe-area-inset-bottom 的跨頁面一致性（A.4）

- **問題**：`style.css` 的 footer / edit-fab / speed-dial / info-sheet-panel 已加 `safe-area-inset-bottom`。`edit.css` 和 `manage.css` 的 footer 也有。但 `setting.css` 完全沒有。`shared.css` 也沒有全域基線防護。
- **嚴重度**：🟢低
- **建議**：確認 setting.html 底部是否有互動元素。長期考慮在 `shared.css` 加全域 `padding-bottom: env(safe-area-inset-bottom)`。

### 3. [#11 UX] formatPillLabel 移除星期後的佈局影響（A.5）

- **問題**：DayNav pill 從 `MM/DD（星）` 改為只顯示 `MM/DD`，pill 寬度縮小約 40%。影響水平捲動行為、桌面版空白、觸控目標比例。
- **嚴重度**：🟢低
- **建議**：QC 在 5 天行程和 15 天行程下截圖驗證佈局。

### 4a. [#4 資安 / #2 程式] mapDayResponse 的逐欄映射（A.6 + E.3）

- **問題**：E.3 已將 `...(raw as unknown as Day)` 改為逐欄映射，解決了第一輪 #4a 的 double assertion 問題。新的 `mapDayResponse`（useTrip.ts:13-25）明確列出 8 個欄位。若 API 未來新增欄位，會被靜默丟棄。
- **嚴重度**：🟢低（已從 🟡 下修——逐欄映射是正確做法）
- **建議**：在 `mapDayResponse` 上方加註釋「新增 Day 欄位時須同步此映射」。F.5 已補齊 `updated_at` fallback，映射與 `Day` interface 一致。

### 4b. [#9 資料完整] mapDayResponse 只在 useTrip.ts，其他呼叫點未覆蓋（A.6）

- **問題**：`TripPage.tsx:339` 的 `fetchAllData` 也直接 `apiFetch<RawDay>` 但未經 `mapDayResponse`，形成 camelCase / snake_case 雙重標準。下載功能使用 raw snake_case 欄位名（`day.day_num`、`day.day_of_week`），與 hook 內的映射路徑不一致。
- **嚴重度**：🟡中
- **建議**：export `mapDayResponse` 供其他模組使用，或至少加 code comment 標記。

### 4c. [#2 程式] snake/camel 混合模式的架構債（A.6）

- **問題**：`DaySummary` 用 `day_num`，`Day` 用 `dayNum`。同一概念在不同型別有不同名稱。
- **嚴重度**：🟢低
- **建議**：記為技術債。

### 5. [#9 資料完整] drivingStats.ts 還原後的完整性（A.6）

- **問題**：`DayLike` 已使用 `dayNum: number`（required）。`calcTripDrivingStats` 的呼叫端（TripPage.tsx:747）傳入 `Object.values(allDays)`，這些 Day 物件都經過 `mapDayResponse`，所以 `dayNum` 保證存在。已確認安全。
- **嚴重度**：🟢低（已從 🟡 下修）
- **建議**：無

### 6a. [#11 UX] SpeedDial 2x4 grid — 8 按鈕是否太多（B.1-B.3）

- **問題**：iOS HIG action sheet 通常優先放高頻操作。低頻功能是否需要在第一層？
- **嚴重度**：🟢低
- **建議**：需 Key User 確認。

### 6b. [#8 相容性] SpeedDial 2x4 在小螢幕可能溢出（B.1-B.3）

- **問題**：iPhone SE 可用高度 ~567px，grid 頂部只剩 119px。緊迫但不溢出。橫向模式（320px 高）則會溢出。CSS 沒有 `max-height` 或 `overflow-y` 防護。
- **嚴重度**：🟡中
- **建議**：加 `max-height: calc(100dvh - var(--fab-size) - 32px); overflow-y: auto;` 到 `.speed-dial-items`。QC 在 iPhone SE 橫向模擬器下截圖驗證。

### 7a. [#2 程式] useSwipeDay useRef — 合理性評估（B.4）

- **問題**：呼叫端已做了 `useCallback`，不穩定原因是依賴的 state 變化。`useRef` 是正確解法。先前質疑有誤——已下修。
- **嚴重度**：🟢低（下修）
- **建議**：保持現狀。

### 7b. [#3 品質] useSwipeDay 的測試覆蓋（B.4）

- **問題**：swipe 閾值邏輯有多個邊界情況，是否有單元測試？
- **嚴重度**：🟢低
- **建議**：補測試覆蓋。

### 8. [#2 程式] InfoSheet classList.add/remove 在 React 中的安全性（B.5）

- **問題**：直接用 `classList.add('dragging')` / `.remove('dragging')`。F.9 已加註釋說明原因（CSS-only transition control）。目前 className 無動態部分所以安全。
- **嚴重度**：🟢低（已從 🟡 下修——F.9 加了註釋）
- **建議**：保持現狀。

### 9a. [#8 相容性] dn-active-label 被 overflow: hidden 裁切（B.6）

- **問題**：`.dn-active-label` 用 `position: absolute; top: calc(100% + 4px)` 定位。`.dh-nav` 的 `padding: 4px 0` + `overflow-x: auto` + `.sticky-nav` 的 `overflow: hidden` 會裁切 label。**label 幾乎肯定不可見。**
- **嚴重度**：🔴高
- **建議**：必須修改。增加 `.sticky-nav` 的 `overflow: visible`（但需評估副作用），或改 `.dh-nav` 的 padding-bottom，或改用不同定位策略。

### 9b. [#11 UX] dn-active-label 長標籤截斷（B.6）

- **問題**：`white-space: nowrap` 但沒有 `max-width` / `text-overflow: ellipsis`。長標籤如「美國村+Sunset Beach+北谷公園」會超出覆蓋相鄰 pill 或螢幕邊緣。
- **嚴重度**：🟡中
- **建議**：加 `max-width: 120px; overflow: hidden; text-overflow: ellipsis;` 到 `.dn-active-label`。

### 9c. [#7 無障礙] SpeedDial 鍵盤導航（B.1-B.3）

- **問題**：F.4 已加 `aria-controls="speedDialItems"`，但打開時焦點未自動移到第一個 item。DOM 順序可能與視覺順序不一致。
- **嚴重度**：🟢低
- **建議**：auto-focus 第一個 item。考慮 `role="menu"` + `role="menuitem"`。

---

## Part 2: Group E 修改質疑（HIGH 預存修復）

### E.1 [#11 UX] sticky-nav 移除 border-bottom 後的分隔

- **問題**：E.1 將 `.sticky-nav` 的 `border-bottom` 移除，改用 `background: color-mix(in srgb, var(--color-background) 85%, transparent)` + `backdrop-filter: blur(12px)`。半透明毛玻璃效果在大部分情況下可提供足夠的分隔感，但在純白背景捲動到白色內容時可能完全透明。
- **嚴重度**：🟢低
- **建議**：QC 在白色背景主題下捲動驗證。

### E.2 [#11 UX / #8 相容性] print-mode 與 @media print 的 border 不一致

- **問題**：E.2 移除了 `.print-mode .tl-card, .print-mode .info-card` 的 `border` 和 `.print-mode .day-header` 的 `border-bottom`。但 `@media print`（style.css:405-407）仍保留：
  - `.tl-card, .info-card { border: 1px solid var(--color-border) !important; }`
  - `.day-header { border-bottom: 1px solid var(--color-border) !important; }`

  「列印預覽模式」（`.print-mode` class）和「實際列印」（`@media print`）的視覺效果不一致。使用者在螢幕上看到的列印預覽是無框線的，但實際 Ctrl+P 列印出來會有框線。WYSIWYG 原則被打破。
- **嚴重度**：🔴高
- **建議**：統一設計意圖。如果無框線，`@media print` 也應移除。如果列印需要框線輔助閱讀，那 `.print-mode` 也應保留。兩者必須一致。

### E.3 [#2 程式] mapDayResponse 逐欄映射完整性

- **問題**：逐欄映射與 `Day` interface 一致（id, dayNum, date, dayOfWeek, label, weather, updatedAt, hotel, timeline）。`hotel` 和 `timeline` 的巢狀結構直接 pass-through 為 `Day['hotel']` / `Day['timeline']`，依賴 API response 已經是正確結構。若 API 回傳的 hotel/timeline 內部欄位是 snake_case，這些不會被映射。
- **嚴重度**：🟡中
- **建議**：確認 API 的 hotel/timeline 巢狀結構在 server side 已轉為 camelCase。若否，需要對應的巢狀映射。目前 `mapDay.ts` 的 `toHotelData` / `toTimelineEntry` 已處理 snake/camel fallback，所以 render 端是安全的，但 TypeScript 型別標註可能不準確。

### E.4 [#2 程式] InfoSheet preventScroll 型別修復

- **問題**：E.4 將 `preventScroll as unknown as React.TouchEventHandler/WheelEventHandler` 拆為兩個正確型別的 handler。確認 `InfoSheet.tsx:169-175` 已正確實作 `preventTouchScroll(e: React.TouchEvent)` 和 `preventWheelScroll(e: React.WheelEvent)`。修復正確。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### E.5 [#2 程式] useSwipeDay dep array 跳過

- **問題**：Engineer A 判斷「無 dep array = 每次 render 更新 ref」是正確行為而跳過。確認 `useSwipeDay.ts:22-24` 的 ref 同步模式是 React 官方推薦做法。加 `[]` 反而會造成 stale closure（與 B.4 修復的 bug 完全相同）。**判斷正確。**
- **嚴重度**：🟢低（判斷正確）
- **建議**：無

### E.6 [#2 程式] drivingStats typeof guard

- **問題**：`drivingStats.ts:66` 從 `typeof t === 'string' ? (t as unknown as string) : ''` 改為 `typeof t === 'string' ? t : ''`。正確——`typeof` guard 已足夠收窄型別，不需要 assertion。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

---

## Part 3: Group F 修改質疑（MEDIUM 預存修復）

### F.1 [#2 程式] hw-grid gap token 化

- **問題**：`.hw-grid` gap 從 `4px` 改為 `var(--spacing-1)`。但搜尋結果顯示 style.css:159 的 `.hw-grid` 實際寫的是 `gap: 8px`，而行 425 mobile media query 才寫 `gap: var(--spacing-1)`。這表示桌面版仍是 `8px` hardcoded，只有 mobile 被 token 化。不一致。
- **嚴重度**：🟢低
- **建議**：桌面版的 `8px` 也應改為 `var(--spacing-2)` 以保持一致。

### F.2 [#7 無障礙] DayNav tooltip aria-describedby

- **問題**：每個 pill button 加了 `aria-describedby={showTooltip ? tooltipId : undefined}`，tooltip span 加了 `id={tooltipId}`。但 tooltip 是條件渲染的——只在 `showTooltip` 為 true 時才存在 DOM 中。`aria-describedby` 也只在 `showTooltip` 時設定。**邏輯正確**——兩者同步出現/消失。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### F.3 [#2 程式] SpeedDial trigger icon 統一

- **問題**：hardcoded SVG `<path d="M12 8l-6 6h12z" />` 改為 `<Icon name="expand_less" />`。需確認 `Icon` 元件的 `expand_less` 圖示與原本三角形視覺一致。
- **嚴重度**：🟢低
- **建議**：QC 截圖驗證。

### F.4 [#7 無障礙] SpeedDial trigger aria-controls

- **問題**：trigger button 加了 `aria-controls="speedDialItems"`。`id="speedDialItems"` 在 `.speed-dial-items` div 上（SpeedDial.tsx:110）。正確。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### F.5 [#9 資料完整] useTrip.ts updated_at fallback

- **問題**：`mapDayResponse` 的 `updatedAt` 行已改為 `(raw.updatedAt as string | undefined) ?? (raw.updated_at as string | undefined)`。與其他欄位的 camelCase-first fallback 模式一致。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### F.6 [#3 品質] fetchDay silent catch 加 console.warn

- **問題**：`useTrip.ts:74-76` 的 catch 已改為 `console.warn('fetchDay failed:', err)`。但行 162-164 的 day batch fetch 仍是空 catch。行 196-198 的 doc fetch 也是空 catch。修復不完整——只改了 `fetchDay` 一處。
- **嚴重度**：🟢低
- **建議**：其他空 catch 也應加 console.warn，至少在 development mode 下。已在第一輪 E9 記為低優先技術債。

### F.9 [#2 程式] InfoSheet classList 註釋

- **問題**：F.9 在 `classList.add('dragging')` 和 `classList.remove('dragging')` 前加了註釋說明原因。但兩處的註釋文字完全相同（`// Direct DOM mutation — React state not needed for CSS-only transition control`）。重複的行內註釋稍顯冗餘。
- **嚴重度**：🟢低
- **建議**：可在第一處加完整說明，第二處簡化為 `// (see above)`。非阻擋。

### F.10 [#2 程式] drivingStats text null guard

- **問題**：`drivingStats.ts:70` 加了 `if (!text) return` guard。但行 66 已有 `typeof t === 'string' ? t : ''` 確保 text 至少是空字串。text 為 `''` 時 `!text` 為 true 會直接 return，跳過後續的 regex match。**功能正確**——空字串沒有可匹配的數字，早期 return 反而避免無意義的 regex 執行。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### F.12-F.15 [#2 程式] TripPage type guard 模式不一致

- **問題**：F.12~F.15 在 TripPage.tsx 中對四個不同位置使用了不同的 type guard 模式：
  - 行 100：`'weather_json' in (day as Record<string, unknown> ?? {})` — `in` 操作符
  - 行 155：`hotel && typeof hotel === 'object'` — truthy + typeof
  - 行 162：`typeof e === 'object' && e !== null` — typeof + null check
  - 行 432/517：`e.travel !== null && typeof e.travel === 'object'` — 又一種排列

  四種寫法功能等價但風格不統一，增加維護認知負擔。
- **嚴重度**：🟢低
- **建議**：統一為 `typeof x === 'object' && x !== null` 模式，或抽出工具函式 `isRecord(x): x is Record<string, unknown>`。不影響功能正確性。

### F.16 [#2 程式] SWIPE_DIRECTION_RATIO 常數

- **問題**：magic number `1.2` 抽為模組頂層常數 `SWIPE_DIRECTION_RATIO`。命名清晰，有 JSDoc 註釋。修復正確。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

---

## Part 4: Group G 修改質疑（LOW 預存修復）

### G.3 [#2 程式] SpeedDial backdrop scroll prevention 註釋

- **問題**：G.3 加了行內註釋說明用途。確認 SpeedDial.tsx:100 的 `{/* Backdrop: prevent scroll passthrough... */}` 已正確放置。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### G.4 [#2 程式] RawDay 型別收窄

- **問題**：TripPage.tsx:307-326 將 `RawDay` 從 `Record<string, unknown> & {...}` 拆為三個具體型別：`RawDayEntry`、`RawHotel`、`RawDay`。這些型別只在 `handleDownloadFormat` 內使用（下載功能），不影響主要 render 路徑。但 `RawDayEntry` 的 `[key: string]: unknown` index signature 仍然允許任意屬性存取，收窄效果有限。
- **嚴重度**：🟢低
- **建議**：若要更嚴格的型別安全，可考慮移除 index signature。但下載功能本質上就是處理 raw API 資料，保留彈性可以理解。

### G.5 [#2 程式] sheetContent memo 移除未使用的依賴

- **問題**：`handleDownloadOpen` 從 `sheetContent` memo 的依賴陣列中移除。確認 sheetContent 內部確實不使用 `handleDownloadOpen`——tools submenu 直接呼叫 `handleDownloadFormat`，不需要 `handleDownloadOpen`。**修復正確。**
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### G.7 [#2 程式] useSwipeDay passive listener 註釋

- **問題**：G.7 在 `touchstart`/`touchend` listener 前加了說明 `passive: true` 原因的註釋。內容正確——這些 handler 不呼叫 `preventDefault()`，所以 passive 可以改善捲動效能。
- **嚴重度**：🟢低（修復正確）
- **建議**：無

### G.8 [#2 程式] tl-flag clip-path 評估

- **問題**：G.8 評估後跳過——`.tl-flag` 的 `clip-path: polygon(... calc(100% - 10px) ...)` 中的 `10px` 是幾何形狀切角定義，非語意間距/圓角 token。**判斷正確。**
- **嚴重度**：🟢低（判斷正確）
- **建議**：無

---

## Part 5: 殘留問題（新發現）

### N.1 [#2 程式] TripPage 行 794 殘留 as unknown as

- **問題**：`TripPage.tsx:794` 中 `TodayRouteSheet` 的 events prop 仍使用 `toTimelineEntry(e as unknown as Record<string, unknown>)`。F.14 已修復行 162 的相同模式（加 typeof guard），但 sheetContent memo 內的這一處未被修復，型別不安全寫法殘留。
- **嚴重度**：🟡中
- **建議**：應與行 162 使用相同的 type guard 模式修復。

### N.2 [#5 效能 / #11 UX] SpeedDial stagger delay 只到第 6 個

- **問題**：CSS `transition-delay` 只定義到 `:nth-child(6)`（style.css:579-584），但 `DIAL_ITEMS` 有 8 個項目。第 7（交通統計）和第 8（設定）item 沒有 stagger delay，會與第 6 個同步出現，打破漸進展開的視覺節奏。**本次 B.3 修改的遺漏。**
- **嚴重度**：🟡中（直接影響 B.3 完成度）
- **建議**：補上 `nth-child(7) { transition-delay: 180ms; }` 和 `nth-child(8) { transition-delay: 210ms; }`。

### N.3 [#2 程式] InfoSheet .dragging class 無對應 CSS

- **問題**：B.5 加了 `.dragging` class toggle（InfoSheet.tsx:102-103,114-115），但搜尋整個 CSS codebase 未找到 `.dragging` 或 `.info-sheet-panel.dragging` 的樣式定義。class 被加上了但沒有對應的 CSS 效果——目前是空操作。
- **嚴重度**：🟡中
- **建議**：確認是否為 Group C（C.6 手勢整合）的前置準備。若是，應在報告中註明。若不是，應補上 CSS（如 `transition: none` 以禁用 drag 過程中的高度動畫）或移除無用的 class toggle。

---

## 廣泛架構問題（保留自第一輪）

### EA.1 [#4 資安] mapDay.ts 大量 `as` type assertion

- **問題**：40+ 處 type assertion。Entry 型別已定義但使用端退化成 untyped Record。
- **嚴重度**：🟡中（架構債）
- **建議**：讓 mapper 函式直接接受 typed interface。

### EA.2 [#9 資料完整] snake_case / camelCase 混合 — 系統性問題

- **問題**：3 個 interface 使用 snake_case，4 處 runtime fallback 同時檢查兩種命名。
- **嚴重度**：🟡中（架構債）
- **建議**：統一策略。

### EA.3 [#6 漏洞] marked.js 版本是否有已知 CVE

- **問題**：marked.js 歷史上有多個 CVE。需確認版本。
- **嚴重度**：🟡中
- **建議**：執行 `npm audit` 確認。

---

## 總摘要

| 嚴重度 | 數量 | 項目 |
|--------|------|------|
| 🔴高 | 2 | #9a dn-active-label 被 overflow:hidden 裁切、E.2 print-mode 與 @media print border 不一致 |
| 🟡中 | 9 | #1 border-left 辨識度、#4b mapDayResponse 跨模組一致性、#6b SpeedDial 小螢幕溢出、#9b active-label 長標籤、E.3 巢狀映射、N.1 殘留 as unknown as、N.2 stagger delay 不完整、N.3 .dragging 無 CSS、EA.3 marked.js CVE |
| 🟢低 | 24 | #2 #3 #4a #4c #5 #6a #7a #7b #8 #9c E.1 E.4 E.5 E.6 F.1 F.2 F.3 F.4 F.5 F.6 F.9 F.10 F.12-15 F.16 G.3 G.4 G.5 G.7 G.8 EA.1 EA.2 |

### 需立即處理（阻擋合併）

1. **🔴 #9a**：dn-active-label 被 overflow:hidden 裁切 — B.6 功能不可見
2. **🔴 E.2**：print-mode 與 @media print 的 border 不一致 — WYSIWYG 原則被打破

### 建議合併前處理

3. **🟡 N.2**：stagger delay 缺 child 7-8 — B.3 動畫不完整
4. **🟡 N.3**：.dragging class 無對應 CSS — B.5 空操作
5. **🟡 N.1**：TripPage:794 殘留 `as unknown as` — F.14 修復不完整
