## Context

行程主頁 sticky-nav 與 timeline 有五項視覺瑕疵需修正。所有變更限於 `css/style.css` 與 `js/app.js`，不涉及 HTML 結構或資料格式變動。

## Goals / Non-Goals

**Goals:**
- 修正 Day pill 圓角裁切
- 桌面版 nav pills 視覺置中
- 深色模式 sticky-nav 底線清晰可辨
- 合併到達/離開旗標為單一旗標
- 移除 transit 段無用的 → 箭頭

**Non-Goals:**
- 不改動 `.col-row` 的 ＋/－ 展開收合機制
- 不改動 JSON 資料結構
- 不改動 edit.html / setting.html

## Decisions

### D1：Day pill 裁切修正 — 加 padding 而非改 overflow

`.dh-nav` 設定 `overflow-x: auto` 讓 pills 可水平捲動，但瀏覽器會隱性將 `overflow-y` 也設為 `auto`，造成 pill 圓角被 clip。

- **選定**：加 `padding: 2px 0` 給 `.dh-nav`，讓 pill 在 container 內有空間不被裁
- **替代**：改用 `overflow-x: clip` — 會失去水平捲動能力，pill 多時無法操作

### D2：桌面版 pills 置中 — brand/actions 等寬

目前 flex 結構為 `[brand] [nav-wrap flex:1] [actions]`，pills 只在 nav-wrap 內置中。

- **選定**：讓 `.nav-brand` 和 `.nav-actions` 同寬（用 `min-width` 固定為相同值），pills 自然在 nav 中視覺置中
- **替代**：nav-wrap 用 `position: absolute; left:50%; transform: translateX(-50%)` — 脫離 flow 較脆弱，需額外處理寬度限制

### D3：深色模式底線 — 用 `--gray-light` 而非新色值

- **選定**：`body.dark .sticky-nav { border-bottom-color: var(--gray-light); }` — `--gray-light: #343130` 仍然太暗。改為直接在 dark mode 中對 sticky-nav 使用 `rgba(255,255,255,0.15)` 半透明白線，在任何深色背景上都有穩定對比度
- **替代**：用 `--gray`（#9B9590）— 太亮太突兀，與無框線設計語言衝突

### D4：旗標合併 — arrive flag 內嵌時間範圍

將 `tl-flag-depart` 移除，離開時間併入 arrive flag：

```
現狀:  [① 16:30]  ...card...  [18:30]
修改後: [① 16:30-18:30]  ...card...
無 end: [① 16:30]  ...card...
```

CSS 的 `.tl-flag-depart` 相關樣式可完全刪除。

### D5：transit 箭頭移除 — 刪 render + CSS

移除 `app.js` 中 `.tl-transit-arrow` 的 HTML 輸出，刪除 `style.css` 中 `.tl-transit-arrow` 樣式。

## Risks / Trade-offs

- **D1 padding 副作用**：2px padding 可能影響 nav pills 區域的漸層遮罩對齊 → 影響極小，漸層用 `top:0; bottom:0` 會自動包含 padding
- **D2 固定寬度脆性**：若未來 actions 加更多按鈕，固定 min-width 可能不夠 → 用 CSS variable 集中管理，日後調整一處即可
- **D4 無離開旗標**：失去視覺上「離開此地」的獨立標記 → 時間範圍格式（16:30-18:30）已充分表達停留區間
