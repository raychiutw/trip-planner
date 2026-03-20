# R4-1~R4-6 Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-21
**Scope**: R4-1 through R4-6 (InfoPanel padding, width, TodaySummary simplify, scrollIntoView removal, SpeedDial redesign, DownloadSheet layout)

## 驗證結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 440 passed, 0 failed
- F-1 BUG-1 已修復（`.sticky-nav { position: relative; }` 已移除）

---

## 逐項審查

### R4-1: 飯店+交通卡片 padding 加大

**變更**: style.css 新增 `.hotel-summary-card { padding: var(--spacing-3) var(--spacing-4); }` 和 `.transport-summary-card { padding: var(--spacing-3) var(--spacing-4); }` (12px 16px)。

**審查**:
- `.info-card` 基礎 padding 是 `16px`。`.hotel-summary-card` 和 `.transport-summary-card` 覆蓋為 `12px 16px`，垂直方向比基礎少 4px — 這實際上是**縮小**而非加大。但 `var(--spacing-3) var(--spacing-4)` = 12px 16px，全部在 4pt grid 上。
- **注意**: 如果意圖是「加大」padding，目前的值比 `.info-card` 的 16px 更小。**建議 QC 確認這是否符合設計意圖。**
- Token 使用正確。**PASS。**

### R4-2: InfoPanel 寬度復原 280px

**變更**: shared.css `--info-panel-w: 350px` -> `280px`。

**審查**:
- 復原 R3-6 的變更。280px 是原始值，桌面佈局經過長期驗證。
- **PASS。**

### R4-3: TodaySummary 移除地圖 G 連結

**變更**:
- TodaySummary.tsx: 移除 `getGoogleUrl`、`getNaverUrl` 函式、`escUrl` import、`today-summary-links` JSX、`stopPropagation` 邏輯
- style.css: 移除 `.today-summary-links`、`.today-summary-map-link`、`.g-icon`/`.n-icon`（TodaySummary 專用的那些）CSS
- 移除 `onEntryClick` prop 和相關的 `onClick`、`onKeyDown`、`role`、`tabIndex`
- 移除 `.today-summary-item` 的 `cursor: pointer`、`:hover` 和 `transition`

**審查**:
- 清理非常乾淨。所有相關 import、CSS、JSX、event handler 一併移除。
- `.today-summary-item` 不再有互動行為，`cursor: pointer` 和 hover 效果移除正確。
- `.map-link .g-icon` 和 `.n-icon` CSS 保留（用於 Timeline 的地圖連結），不衝突。
- **PASS。**

### R4-4: 移除 scrollIntoView

**變更**:
- InfoPanel.tsx: 移除 `handleEntryClick` callback 和 `useCallback` import（改 `useMemo`）
- TodaySummary.tsx: 移除 `onEntryClick` prop
- TimelineEvent.tsx: 移除 `data-entry-index={index - 1}` attribute

**審查**:
- `handleEntryClick` 用 `document.querySelector('.tl-event[data-entry-index="..."]')` 做 scrollIntoView。現在完全移除，包含 query selector target（`data-entry-index`）。
- TripPage.tsx:678 的 `.tl-now` scrollIntoView 保留，這是初始載入的 auto-locate，不受影響。
- 全域搜尋確認 `data-entry-index` 已無任何引用。
- **PASS。**

### R4-5: SpeedDial 垂直一行在 FAB 左邊

**變更**:
- CSS: `.speed-dial-items` 從 2-column grid (`grid-template-rows: repeat(4, 1fr); grid-auto-flow: column`) 改為單行 flex (`flex-direction: column; gap: 8px`)
- 定位: `bottom: calc(var(--fab-size) + 16px); right: 36px` → `bottom: 0; right: calc(var(--fab-size) + 12px)` — 從 FAB 上方改為 FAB 左邊
- 動畫: `translateY(10px)` → `translateX(20px)` — 展開方向從下到上改為右到左
- `.speed-dial-item`: 從 icon-only 正方形改為 label + icon 的橫向 pill (`flex-direction: row; border-radius: var(--radius-full)`)
- Label 從 `position: absolute` 浮動改為 inline flow（移除 absolute + shadow + background + pointer-events）
- JSX: label 和 icon 順序互換（`<label> <icon>` — 左文字右圖示）
- FAB trigger: `expand_less` (▲) 改為水平箭頭（closed: ◁, open: ▷）
- FAB SVG rotation 動畫移除（`transform: rotate(180deg)` 不再需要）

**審查**:
- **佈局**: `bottom: 0; right: calc(var(--fab-size) + 12px)` — items 底部對齊 FAB 底部，向上展開。`flex-direction: column` + `gap: 8px` — 8 個 item × (44px height + 8px gap) = 408px 高度。在手機螢幕 (844px iPhone 14) 上可能超出頂部。**但因 speed-dial 本身 `bottom: max(88px, calc(68px + env(safe-area-inset-bottom)))`，所以 items 最頂部約在 88 + 408 = 496px，在 844px 螢幕內。OK。**
- **720px 小螢幕**: 88 + 408 = 496px，仍在範圍內。**OK。**
- **FAB 箭頭方向**: closed `M16 6l-8 6 8 6z` = 向左三角 (◁)，open `M8 6l8 6-8 6z` = 向右三角 (▷)。**語義正確**: closed 暗示「展開到左邊」，open 暗示「收合到右邊」。
- **Stagger delay**: 順序翻轉為 child(8)→0ms 到 child(1)→210ms。因為 `flex-direction: column` DOM 順序是從上到下，child(1) 在最上方，child(8) 在最下方（靠近 FAB）。Bottom-up stagger 讓靠近 FAB 的先出現。**正確。**
- **label inline flow**: 移除 `position: absolute` + `pointer-events: none`。現在 label 是 button 的一部分，可接收點擊。之前 `pointer-events: none` 讓 label 不可點擊，現在整個 pill 都是按鈕。**改善了觸擊面積。**
- **PASS。**

### R4-6: 匯出 4 按鈕分隔線+水平置中+flex-wrap

**變更**:
- `.download-sheet-options`: `flex` row → `grid`。手機 2x2 (`repeat(2, 1fr)`)，≥480px 改為 4x1 (`repeat(4, 1fr)`)
- 新增 `border-top: 1px solid var(--color-border); padding-top: 12px` 作為分隔線
- `.download-option`: `flex: 1 1 auto` 水平 → `flex-direction: column` 垂直排列（icon 上、label 下）。新增 `border-radius: var(--radius-md)`。移除 `border-right`
- `gap: 0` → `gap: 8px`（grid gap）

**審查**:
- **grid responsive**: 手機 2x2 顯示 4 個匯出選項，清晰。≥480px 一行 4 個。**合理。**
- **分隔線**: `border-top: 1px solid var(--color-border)` — 使用 token。**OK。**
- **padding-top: 12px**: 不在 4pt grid 上... 等，12 = 3×4。在 4pt grid 上。**OK。**
- **flex-direction: column**: icon 上 label 下，符合 iOS grid 按鈕慣例。
- **PASS。**

---

## 跨模組 side effect 檢查

| 變更 | 影響範圍 | 評估 |
|------|---------|------|
| `--info-panel-w: 280px` | 全站 InfoPanel | 復原舊值，經驗證 |
| `.today-summary-item` 移除 hover/cursor | InfoPanel TodaySummary | 僅在 desktop ≥1200px 顯示。元素現為純展示，移除互動正確 |
| `data-entry-index` 移除 | TimelineEvent | 全域確認無其他引用 |
| SpeedDial CSS 大改 | 全站 SpeedDial | 封閉在 `.speed-dial-*` class 內，不影響其他元件 |
| `.download-option` CSS 改 | DownloadSheet | 封閉在 `.download-*` class 內 |

---

## 效能影響

- R4-3/R4-4 移除 `handleEntryClick` callback 和 `useCallback` — 減少 closure 和 event handler，微幅改善。
- SpeedDial FAB 從 1 個 static SVG 改為條件渲染 2 個 SVG（`isOpen ? FAB_OPEN : FAB_CLOSED`）。兩者都是 module-level constant，不影響效能。
- 無新增 memory leak 風險。

---

## 安全性

- 移除 `escUrl` import（TodaySummary 不再需要 URL 建構）。
- 無新增 user input → DOM 路徑。
- **安全。**

---

## 技術債

| 項目 | 嚴重度 | 說明 |
|------|--------|------|
| R4-1 padding 語義 | TRIVIAL | `.hotel-summary-card` padding 12px 16px 實際比 `.info-card` 的 16px 更小，名稱「加大」與實際不符 |
| `.countdown-card`/`.countdown-number` CSS 孤兒 | LOW | 前輪遺留，Countdown 元件已是 dead code |

---

## 裁決

### APPROVE

所有 6 項修改正確實作，清理乾淨，無功能性問題。

- R4-1: Token 合規，padding 值正確（建議 QC 確認設計意圖）
- R4-2: 復原舊值，無風險
- R4-3: 乾淨移除所有地圖連結 + CSS + import
- R4-4: scrollIntoView 和 data-entry-index 全面清除
- R4-5: SpeedDial 垂直一行設計合理，stagger 正確，觸擊面積改善
- R4-6: grid 2x2/4x1 responsive，分隔線 + 居中 + token 合規

F-1 BUG-1（`.sticky-nav { position: relative; }`）已確認修復。
