# Design: desktop-ui-overhaul

## 架構決策

### 色彩策略：僅淺色模式

- 變更僅影響淺色模式（`body:not(.dark)`），深色模式不動
- 新增 CSS 變數 `--card-bg: #EDE8E3`（暖灰），集中管理卡片背景色
- 頁面背景從 `var(--gray-light)` 改為 `var(--white)`，製造卡片與背景的色差

### 色彩對照表

| 元素 | 修改前 | 修改後 |
|------|--------|--------|
| `body` 背景 | `#FAF9F7` (gray-light) | `#FFFFFF` (white) |
| section / footer / info-card | `#FFFFFF` | `#EDE8E3` (card-bg) |
| `.day-header` | gray | `#C4704F` (Claude 橘), 文字白 |
| `.sidebar` | 預設 | `#EDE8E3` (card-bg) |
| `.info-panel` | 預設 | `#EDE8E3` (card-bg) |
| `.sticky-nav` | 預設 | `#EDE8E3` (card-bg) |
| focus outline | 瀏覽器預設 | `box-shadow: 0 0 0 2px var(--blue)` |

### 佈局：填滿三欄

- `≥1200px`：移除 `#tripContent` 的 `max-width: 800px`，改為 `max-width: none`
- `.page-layout` 加 `gap: 12px` 三欄等間距
- 修復漢堡選單 bug：sidebar collapsed 時在 `.sticky-nav` 顯示 `.dh-menu` 按鈕

### Nav Pills 溢出機制

```
┌─ .dh-nav-wrap ──────────────────────────────────┐
│ [◀] ┌─ .dh-nav (overflow:hidden,flex) ──┐ [▶] │
│     │ Day1 Day2 Day3 Day4 Day5 Day6 ... │      │
│     └────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

- `initNavOverflow()`：動態計算 `.dh-nav` 可容納的 pill 數量
- 超出時啟用溢出模式：左右加漸層遮罩（CSS pseudo-element `mask-image`）
- 桌機 ≥768px：顯示左右箭頭按鈕，點擊平滑捲動一頁寬度
- 手機 <768px：不顯示箭頭，僅漸層遮罩 + 手指滑動
- 到邊界隱藏箭頭（`visibility: hidden` 保留空間）
- `updateNavArrows()` 監聽 scroll 事件更新狀態

## 檔案影響

| 操作 | 檔案 |
|------|------|
| 修改 | `css/shared.css`（--card-bg, body bg, focus-visible, gap） |
| 修改 | `css/style.css`（section/footer/header/panel bg, max-width, nav arrows） |
| 修改 | `css/menu.css`（sidebar bg, hamburger fix） |
| 修改 | `js/app.js`（initNavOverflow, updateNavArrows, buildMenu nav-wrap） |
| 修改 | `index.html`（nav-wrap + arrow buttons 結構） |
