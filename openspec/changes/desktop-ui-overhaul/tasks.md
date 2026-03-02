# Tasks: desktop-ui-overhaul

## 色彩（淺色桌機）

- [x] shared.css：新增 `--card-bg: #EDE8E3` 變數
- [x] shared.css：`body` 背景從 `var(--gray-light)` 改為 `var(--white)`（僅淺色，dark mode 不動）
- [x] style.css：`#tripContent section`、`.info-card`、`footer` 背景改 `var(--card-bg)`
- [x] style.css：`.day-header` 背景改 `var(--blue)`（#C4704F），color 改 `var(--white)`，`.dh-date` opacity 調整
- [x] menu.css：`.sidebar` 背景改 `var(--card-bg)`
- [x] style.css：`.info-panel` 背景改 `var(--card-bg)`
- [x] shared.css / menu.css：互動按鈕（`.sidebar-toggle`、`.dh-menu`、`.dn`、`.menu-item`）加 `:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--blue); }` 取代預設 outline
- [x] style.css：`.sticky-nav` 背景改 `var(--card-bg)`

## 佈局（桌機）

- [x] style.css：≥1200px media query 移除 `#tripContent` 的 `max-width`（或改為 `max-width: none`）
- [x] shared.css / style.css：`.page-layout` 在 ≥1200px 加 `gap: 12px`
- [x] menu.css：修復漢堡選單桌機縮小視窗時不能按的問題（sidebar 收合時在 sticky-nav 顯示 dh-menu）

## Nav pills 溢出

- [x] css：`.dh-nav` 左右加漸層遮罩（CSS `mask-image` 或 pseudo-element），僅在對應方向有溢出時顯示
- [x] js/app.js：動態計算可顯示 pill 數量，超過時啟用溢出模式
- [x] js/app.js + css：桌機（≥768px）加左右箭頭按鈕，點擊平滑捲動一頁可見數量
- [x] js/app.js：到邊界時隱藏對應箭頭（visibility: hidden 保留空間）
- [x] 手機不顯示箭頭，僅靠漸層遮罩提示可滑動
