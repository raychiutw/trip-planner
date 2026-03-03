## Context

edit.html 已改造為統一版面（標題列 + 60vw 居中 + 可捲動內容區）。setting.html 使用不同的版面結構，需統一。

## Goals / Non-Goals

**Goals:**
- setting 頁與 edit 頁版面骨架一致
- 標題列顯示「設定」
- 桌機版限寬統一 60vw

**Non-Goals:**
- 不改動行程列表或色彩模式的功能邏輯
- 不改動 color-mode-preview 的硬寫預覽色碼（那是模式展示用的）

## Decisions

### D1: 複用 `.nav-title` 樣式

edit.css 已定義 `.nav-title` 樣式。setting 頁複用同一 class，但標題列樣式需在 setting.css 中覆蓋 `display: none`。

### D2: 移除整頁 card-bg 背景

`.setting-page` 移除 `background: var(--card-bg)`，讓頁面背景為 body `--bg`。各 section 不額外加背景。

### D3: 桌機版限寬改 60vw

`.setting-page` 的 `max-width: 640px` 改為 `60vw`，與 edit 頁 `.chat-messages-inner` 一致。

### D4: active 色碼統一

`.color-mode-card.active` 的 `border-color` 和 `box-shadow` 從 `var(--blue)` 改為 `var(--accent)`。

## Risks / Trade-offs

- [移除 card-bg 背景後 trip-btn 可能需要背景色] → trip-btn 已有自己的 `var(--card-bg)` 背景，不受影響
- [60vw 在超寬螢幕可能太寬] → 與 edit 頁行為一致，可接受
