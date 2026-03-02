## Context

目前 sticky-nav 在 `css/style.css` 使用 `top: 12px; margin: 12px 0; border-radius: 12px` 呈現浮動卡片效果。手機選單展開時，漢堡圖示外觀不變，缺乏關閉的視覺提示。

## Goals / Non-Goals

**Goals:**
- sticky-nav 貼齊視窗頂部（top: 0），移除上下 margin，保留圓角
- 手機選單展開時漢堡 ☰ 平滑變形為 ✕，選單關閉時恢復

**Non-Goals:**
- 不改動 JS 邏輯
- 不調整桌機版 sidebar 的漢堡圖示行為
- 不變更 sticky-nav 的 z-index 或背景色

## Decisions

### 1. sticky-nav 置頂方式

在 `css/style.css` 的 `.sticky-nav` 覆寫區塊：
- `top: 12px` → `top: 0`
- `margin: 12px 0` → `margin: 0`
- 保留 `border-radius: 12px`

桌機版的 `@media (min-width: 768px)` 區塊同步移除 `margin: 12px auto` → `margin: 0 auto`。

### 2. 漢堡 → ✕ 動畫

利用 `body.menu-open` class（已由 menu.js 管理）作為觸發條件，在 `css/menu.css` 加入：

- 第 1 條線：`translateY(5.5px) rotate(45deg)`
- 第 2 條線：`opacity: 0`
- 第 3 條線：`translateY(-5.5px) rotate(-45deg)`

translateY 值 5.5px 來自：hamburger-icon 的 gap 3.5px + span 高度 2px = 5.5px 位移到中心。

hamburger-icon 的 span 已有 `transition: all 0.3s` 屬性，動畫自然平滑。

## Risks / Trade-offs

- sticky-nav 移除 margin 後頂部無留白，在某些瀏覽器圓角可能被裁切 → 實測 iOS Safari / Chrome 確認
- translateY 值依賴 hamburger-icon 的 gap 與 span 高度，若未來調整需同步 → 加 CSS 註解標註計算依據
