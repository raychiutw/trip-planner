## Why

全站 UI 存在多處細節瑕疵，包括 sticky-nav 漢堡選單桌機重複顯示、地圖連結底色不統一、時間軸圓點偏移、天氣區塊排版鬆散、自訂捲軸缺失、色彩模式預設邏輯錯誤、以及 edit/setting 頁面底色與選單不一致等。這些問題雖個別微小，但累積影響使用體驗，應一次性修正。

## What Changes

- **sticky-nav 修正**：移除桌機 sidebar collapsed 時 sticky-nav 內的漢堡選單（`menu.css:109` 規則）；edit/setting 頁桌機版隱藏整個 sticky-nav
- **map-link 統一**：所有 `.map-link` 背景改為透明，hover 底色統一為 `#333`（亮色）/ `#5A5651`（深色）
- **timeline dot 對齊**：修正 `.tl-event::before` 的 `left` 值，消除圓點 ~1px 偏移
- **天氣收合優化**：`.hw-summary` 的 `justify-content` 從 `space-between` 改為 `flex-start`；收合箭頭從 `▸` 改為 `+`/`-`
- **hw-now 框線修復**：`.hw-grid` 加 `padding-top: 2px`，防止 `.hw-now` 的 `box-shadow` 被父元素 `overflow: hidden` 裁切
- **全站自訂捲軸**：在 `shared.css` 統一定義深色/亮色捲軸樣式（細、圓角），取代分散各處的 `scrollbar-width: thin`
- **色彩模式預設 auto**：修正 `shared.js` IIFE，當 localStorage 無 `color-mode` key 時，預設使用 `matchMedia('(prefers-color-scheme: dark)')` 偵測
- **edit/setting 底色**：容器背景改為 `var(--card-bg)`，與 sidebar 底色一致

## Capabilities

### New Capabilities

- `custom-scrollbar`：全站統一捲軸樣式（深色/亮色、細、圓角）

### Modified Capabilities

- `desktop-layout`：移除 sidebar collapsed 時 sticky-nav 顯示漢堡選單的規則；edit/setting 桌機隱藏 sticky-nav
- `edit-page`：容器背景改為 `var(--card-bg)`
- `setting-page`：容器背景改為 `var(--card-bg)`

## Impact

- **CSS**：`css/shared.css`、`css/style.css`、`css/menu.css`、`css/edit.css`、`css/setting.css`
- **JS**：`js/shared.js`（色彩模式 IIFE）、`js/app.js`（天氣收合箭頭渲染）
- **HTML**：無變更
- **JSON**：無變更
- **測試**：需更新色彩模式相關單元測試、天氣收合箭頭測試
