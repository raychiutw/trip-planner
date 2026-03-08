## Why

行程主頁的導覽列與 timeline 存在多項視覺瑕疵：Day pill 圓角被 scroll container 裁切、桌面版 pills 未在 nav 中視覺置中、深色模式底線幾乎不可見、離開時間旗標佔據多餘垂直空間、transit 段的 → 箭頭無互動功能卻佔版面。這些問題影響整體精緻度，需一次性修正。

## What Changes

- **修正 Day pill 圓角裁切**：`.dh-nav` 的 `overflow-x: auto` 隱性將 `overflow-y` 也變成 `auto`，導致 pill 上下圓角被 clip。加 vertical padding 補償。
- **桌面版 nav pills 視覺置中**：目前 pills 只在 `dh-nav-wrap`（flex:1）內置中，因左側 brand 與右側 actions 寬度不同，pills 在頁面上偏移。改為等寬或絕對定位讓 pills 對齊頁面中心。
- **深色模式 sticky-nav 底線加深**：dark mode 的 `--border: #3A3A3A` 與 `--bg: #1A1A1A` 對比不足。針對 sticky-nav 使用更明顯的色值。
- **合併到達/離開旗標**：將離開時間併入到達旗標（如 `16:30-18:30`），移除獨立的 `tl-flag-depart`，減少垂直空間佔用。
- **移除 transit → 箭頭**：刪除 `.tl-transit-arrow` 的 render 與 CSS，該箭頭純裝飾無互動功能。

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `timeline-expand`：到達/離開旗標合併為單一旗標，移除 `tl-flag-depart`；transit 移除 → 箭頭
- `sticky-nav-flush`：深色模式底線色值調整；Day pill 裁切修正；桌面版 pills 視覺置中

## Impact

- `css/style.css`：sticky-nav dark mode border、`.dh-nav` padding、`.tl-flag-depart` 樣式移除、`.tl-transit-arrow` 樣式移除、桌面版 nav 置中調整
- `js/app.js`：`renderTimelineEvent()` 合併旗標、移除 transit arrow render
- `tests/unit/`：timeline render 相關測試需更新（flag 結構變更）
- 不涉及 JSON 結構變更，無 checklist/backup/suggestions 連動
