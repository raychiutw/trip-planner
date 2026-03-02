## Context

設定頁的 `.trip-btn.active` 使用 `box-shadow: 0 0 0 2px` 模擬選中邊框。理論上四邊等粗，但在部分裝置和縮放比例下，box-shadow 的 sub-pixel rendering 會導致視覺上粗細不一。

edit.html 的 `.sticky-nav` 繼承 `shared.css` 的 `background: var(--white)`，在 dark mode 下與頁面 `--bg` 色差明顯，形成一條不需要的淺色橫條。

## Goals / Non-Goals

**Goals:**
- 行程選擇按鈕 active 邊框四邊粗細一致
- 消除 edit 頁面頂部多餘的色條

**Non-Goals:**
- 不改變 index.html 的 sticky-nav 樣式（index 有自己的 style.css 覆蓋）
- 不改變色彩模式卡片（`.color-mode-card`）的 active 樣式

## Decisions

**D1: trip-btn active 改用 CSS border 取代 box-shadow**

- 方案 A（採用）：`border: 2px solid transparent`（預設）→ `border: 2px solid var(--accent)`（active）
- 方案 B：改用 `outline: 2px solid`（不佔空間但不跟隨 border-radius）

選擇方案 A 因為 border 渲染精準、支援 border-radius、跨瀏覽器一致。加 transparent 預設邊框佔位避免 active 切換時版面跳動。

**D2: edit 頁 sticky-nav 背景透明**

在 `edit.css` 加 `.sticky-nav { background: transparent; }` 即可。只影響 edit 頁，index.html 的 `style.css` 有自己的 sticky-nav 背景覆蓋。

## Risks / Trade-offs

- **[border 佔用空間]** → 加 transparent 佔位，切換 active 不跳動
- **[edit 頁 sticky-nav 背景改透明後 scroll 時內容穿透]** → edit 頁的 sticky-nav 只含漢堡鈕、面積小，穿透影響低；且桌機版已 `display: none`
