# R3 Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-20
**Scope**: R3 全 13 項修改（tasks.md 所列）

## 驗證結果

- `npx tsc --noEmit` — 0 errors (confirmed)
- `npm test` — 440 passed, 0 failed (confirmed)
- `css-hig.test.js` — 13 tests passed (CSS HIG 合規)
- `css-selector.test.js` — 2 tests passed (CSS selector-DOM 對齊)

---

## 1. 正確性 + 可讀性 + 測試覆蓋

### R3-10 SpeedDial grid 向左擴展
- **正確**: `right: 0` -> `right: -8px` + `column-gap: 72px` 讓 4×2 grid 兩欄有足夠間距
- **手機螢幕風險**: `column-gap: 72px` 在最小手機寬度 (320px) 上需驗證。8 個 item = 4 rows × 2 columns。每個 item 寬 `var(--tap-min)` = 44px，兩欄 = 88px + 72px gap = 160px。加上 `.speed-dial-label` 的 `right: calc(100% + 8px)` 讓 label 在 icon 左邊。整體寬度可能到 ~280px（含 label），加上 `.speed-dial` 固定在 `right: 20px`，在 320px 手機上左欄 label 可能被截。**但因 SpeedDial 有 backdrop overlay，且 label 用 `white-space: nowrap`，這不會造成功能問題，僅是視覺問題。MEDIUM 風險。**

### R3-11 SpeedDial label pill 樣式
- **正確**: `border-radius: var(--radius-full)` 是 pill 形；`padding: 4px 12px` 在 4pt grid 上（4, 12 皆為 4 的倍數）。工程師說原需求 10px 不在 4pt grid 上，修正為 12px 是正確決策。

### R3-2 設定頁 ← 移除
- **正確**: SettingPage.tsx 中已無 `nav-back-btn`。只保留 `nav-close-btn`（X 按鈕）。CSS `.nav-back-btn` 保留在 shared.css 是合理的，因為 edit 頁仍可使用。

### R3-3 DayNav active label 移除
- **正確**: `dn-active-label` 的 JSX 已從 DayNav.tsx 移除，CSS 區塊已從 style.css 移除，`padding-bottom: 20px` 已從 `.dh-nav-wrap` 移除。全域搜尋確認 source code 中已無 `dn-active-label` 引用（僅歷史報告中殘留）。

### R3-4 InfoPanel 倒數天數移除
- **正確**: `Countdown` import 和渲染已從 InfoPanel.tsx 移除。`autoScrollDates` prop 已移除。全域搜尋確認 `Countdown` 不再被任何檔案 import。

### R3-5 InfoPanel 車程統計移除
- **正確**: `TripStatsCard` import 和渲染已從 InfoPanel.tsx 移除。全域搜尋確認 `TripStatsCard` 不再被任何檔案 import。

### R3-1 Bottom Sheet X 統一
- **正確**: 工程師確認 `.sheet-close-btn` 和 `.nav-close-btn` 都使用 `var(--tap-min)` (44px)，no-op 合理。

### R3-6 InfoPanel 寬度加大
- **正確**: `--info-panel-w: 280px` -> `350px` (+70px)。
- **左欄壓縮分析**: InfoPanel 顯示在 `@media (min-width: 1200px)` 時啟用。`.page-layout` 用 `flex` 佈局，`.container` 有 `flex: 1; min-width: 0`，InfoPanel 有 `flex-shrink: 0`。在 1200px 寬度下：可用寬度 = 1200 - 350 - 12(gap) = 838px，仍遠大於 `--content-max-w: 720px`。在 1200px 到 ~1082px（720 + 350 + 12）之間，container 仍有充足空間。**沒有問題。**

### R3-7 TodaySummary 加地圖連結
- **正確性審查**:
  - `getGoogleUrl`: 先用 `escUrl(entry.maps)` 驗證，若為有效 URL 直接用；否則 fallback 到 `entry.title` 做 Google 搜尋。邏輯正確。
  - `getNaverUrl`: 從 `entry.location` 取 `naverQuery`，用 `escUrl` 驗證。回傳 `null` 表示無 Naver 連結（條件渲染正確）。
  - **型別安全**: `(loc as Record<string, unknown>).naverQuery` — 因為 `Location` 型別有 `[key: string]: unknown` index signature，所以 `loc.naverQuery` 其實可以直接存取（TypeScript 允許），不需要 cast。但 cast 到 `Record<string, unknown>` 也不會造成錯誤，僅是風格問題。**LOW — 建議未來清理。**
- **stopPropagation 正確性**: `<span className="today-summary-links" onClick={(ev) => ev.stopPropagation()}>` — 在 `<li>` 上，`onClick` 觸發 `onEntryClick`。stopPropagation 放在包裹 `<a>` 的 `<span>` 上，正確防止地圖連結點擊觸發 entry scroll。**正確。**

### R3-8 InfoPanel 加飯店 + 當日交通
- **資料來源**: `currentDay.hotel.name` 和 `currentDay.hotel.checkout` 來自 `Day.hotel`（型別 `Hotel | null`），optional chaining `currentDay?.hotel &&` 正確防護 null。
- **交通摘要**: `calcDrivingStats(currentDay.timeline)` 回傳 `DayDrivingStats | null`，null check `{dayTransport && ...}` 正確。`TRANSPORT_TYPE_ORDER` iterate 時 `dayTransport.byType[key]` 可能不存在，`if (!g) return null` 正確跳過。
- **null check 完整性**: 確認無問題。

### R3-9 hover padding 加大
- **正確**: `var(--spacing-1) var(--spacing-2)` -> `var(--spacing-2) var(--spacing-3)` (4px 8px -> 8px 12px)。`margin` 同步調整為 `0 calc(-1 * var(--spacing-3))` 以保持對齊。三個元件（`.col-row`, `.hw-summary`, `.today-summary-item`）同步修改，一致性好。

### R3-12 QC prompt 加強
- **正確**: prompt-template.md 的 QC 區段已加入「截圖視覺驗證優先，DOM 檢查輔助。不能只靠 DOM 判 PASS」。

---

## 2. 架構影響評估

| 修改 | 影響範圍 | 評估 |
|------|---------|------|
| InfoPanel props 簡化 | TripPage.tsx 呼叫端 | TripPage 已移除 `autoScrollDates` 傳遞。OK。 |
| `--info-panel-w` 變更 | 全站（shared.css 變數） | 僅 `.info-panel` 使用此變數。其他地方無引用。OK。 |
| DayNav JSX 移除 | DayNav.tsx 內部 | 無外部 API 變更。OK。 |
| TodaySummary 重寫 | InfoPanel 內部 | 介面不變（`entries` + `onEntryClick`），新增 `maps`/`location` 讀取但都來自既有 `Entry` 型別。OK。 |

---

## 3. 效能影響分析

- **R3-7 TodaySummary**: `memo()` 包裹正確。`getGoogleUrl`/`getNaverUrl` 是純函式，每次 render 僅對當前 entries 計算，無 N^2 問題。
- **R3-8 Transport summary**: `useMemo` 依賴 `[currentDay]`，正確避免重算。`calcDrivingStats` 是 O(n) 線性。
- **R3-4/R3-5 移除**: 減少 render，效能改善。
- 無 memory leak 風險。

---

## 4. 安全性審查

- **XSS**: `escUrl` 函式驗證 URL 必須以 `https?:` 或 `tel:` 開頭，有效阻擋 `javascript:` protocol injection。`encodeURIComponent` 用於 fallback 搜尋字串。**安全。**
- **敏感資訊**: 無新增 API key 或 token。
- **injection**: 無 `dangerouslySetInnerHTML`、`eval`、`innerHTML`。

---

## 5. 向後相容

- InfoPanel props 變更（移除 `autoScrollDates`）：唯一呼叫端 TripPage.tsx 已同步更新。
- `--info-panel-w` 變更：CSS 變數，不影響 JS 呼叫。
- 已移除的 CSS class（`.dn-active-label`、countdown 相關）：對應的 JSX 已同步移除，無斷裂。

---

## 6. Design Pattern 建議

- **Countdown.tsx 和 TripStatsCard.tsx 成為 dead code**: 全域搜尋確認兩者不再被 import。**建議在後續清理 PR 中刪除這兩個檔案。** 目前不影響功能。

---

## 7. 技術債標記

| 項目 | 嚴重度 | 說明 |
|------|--------|------|
| Dead code: `Countdown.tsx`, `TripStatsCard.tsx` | LOW | 不再被 import，可安全刪除 |
| TodaySummary `loc as Record<string, unknown>` | LOW | `Location` 有 index signature，可直接存取 `loc.naverQuery`，不需 cast |
| `.countdown-card`/`.countdown-number` 等 CSS 孤兒 | LOW | 對應元件已移除但 CSS 殘留在 style.css L475-479 |

---

## 8. 跨模組 side effect

- `.col-row` padding 修改（R3-9）：影響所有使用 `.col-row` 的地方（Hotel 區塊、day-overview 內）。`day-overview .col-row` 有自己的 override `padding: 12px 0`（style.css:285），所以 day-overview 內不受 R3-9 影響。**OK。**
- `.hw-summary` padding 修改：僅用於 HourlyWeather 元件。**OK。**
- `.today-summary-item` padding 修改：僅用於 TodaySummary 元件。**OK。**
- `--info-panel-w` 修改：全站唯一引用在 `.info-panel`。**OK。**

---

## 9. /tp-code-verify + /tp-ux-verify

### Code 驗證
- **命名規範**: 新增的 CSS class 遵循 kebab-case（`hotel-summary-name`、`transport-summary-row` 等）。OK。
- **CSS HIG**: 所有 13 項 HIG 測試通過。新增的值使用 design token（`var(--spacing-*)`, `var(--font-size-*)`, `var(--radius-*)`, `var(--color-*)`）。無 hardcoded px 違規（`column-gap: 72px` 是 grid 間距，不受 HIG font-size 限制）。
- **React Best Practices**: `memo`, `useCallback`, `useMemo` 使用正確。依賴陣列無遺漏。
- **CSS selector-DOM 對齊**: 2 tests passed。

### UX 驗證
- **Token 使用**: 新增 CSS 全部使用 design token，無 hardcoded color。
- **4pt grid**: `padding: 4px 12px`（R3-11）、`padding: var(--spacing-2) var(--spacing-3)` = 8px 12px（R3-9）均在 4pt grid 上。`column-gap: 72px` = 4 * 18，在 4pt grid 上。
- **Tap target**: 地圖連結 `.today-summary-map-link` 尺寸 20x20px，**小於 44px tap-min**。但這些是桌面 InfoPanel 專用（手機上 InfoPanel hidden），且在 `<li>` 內部，`<li>` 本身有完整的 tap target。**可接受。**

---

## 重點問題回答

### Q1: SpeedDial column-gap: 72px — 會不會太大？在手機上超出螢幕嗎？
**MEDIUM 風險。** 計算：2 columns x 44px + 72px gap = 160px items 區域。`.speed-dial-label` 在 icon 左側 `right: calc(100% + 8px)`，label 寬度約 40-60px。總計最寬約 260px。`.speed-dial` 固定在 `right: 20px`，所以左邊界約在 screen left 110px（390px 手機）或 40px（320px 手機）。左欄 label 在 320px 手機上可能被截，但 390px（iPhone 14/15 標準）上勉強 OK。**建議 QC 在 320px viewport 做截圖驗證。**

### Q2: InfoPanel 寬度 280->350px — 左欄行程內容會被壓縮嗎？
**無問題。** InfoPanel 僅在 `>= 1200px` 啟用。最小情況 1200px - 350px - 12px gap = 838px，遠大於 `--content-max-w: 720px`。

### Q3: TodaySummary 地圖連結 — stopPropagation 是否正確？
**正確。** `stopPropagation` 放在包裹所有地圖 `<a>` 的 `<span>` 上，阻止冒泡到 `<li>` 的 `onClick`（觸發 `onEntryClick` 做 scroll）。`<a>` 本身的 `target="_blank"` 仍正常運作。

### Q4: 飯店+交通摘要 — 資料來源是否正確？null check？
**正確。** Hotel 用 `currentDay?.hotel && (...)` 防護。Transport 用 `calcDrivingStats()` 回傳 `null` 時不渲染。`TRANSPORT_TYPE_ORDER.map` 中 `if (!g) return null` 正確跳過不存在的交通類型。

### Q5: /tp-code-verify + /tp-ux-verify
**通過。** 見上方第 9 節詳情。

---

## 裁決

### APPROVE

所有 13 項修改正確實作，無功能性問題。3 項 LOW 技術債可在後續清理。1 項 MEDIUM 風險（SpeedDial 72px gap 在 320px 手機）建議 QC 視覺驗證。
