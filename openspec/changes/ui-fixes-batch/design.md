# ui-fixes-batch Design

## 概述

本次變更為一批 UI 小修正，涵蓋 sticky-nav 顯示邏輯、map-link 樣式統一、timeline 圓點對齊、天氣收合優化、捲軸樣式統一、色彩模式預設值等。

## 技術設計

### 1. sticky-nav 修正
- 桌機（≥768px）的 edit 和 setting 頁不需要 sticky-nav（無行程內容），加 `display: none`
- 移除 `menu.css` 中「sidebar collapsed 時顯示 hamburger」的規則（由 sidebar 本身處理）

### 2. map-link 統一
- 所有 `.map-link` 底色改 `transparent`，hover 統一為深色 `#333`
- 深色模式 hover 統一為 `#5A5651`

### 3. timeline 圓點對齊
- `.timeline` 的 border-left 中心在 left: 1px（border 2px）
- `.tl-event` 距 `.timeline` 左邊 18px（padding-left）
- 圓點 width: 10px，要讓圓點中心對齊線中心（1px）
- 圓點 left: `-(18px - 1px + 5px)` = `-22px`

### 4. 天氣收合
- `hw-summary` 改 `flex-start` + `gap: 8px`，摘要文字左對齊
- 箭頭符號改 `+`/`-` 更直觀

### 5. hw-now 框線修復
- `.hw-grid` 加 `padding-top: 2px` 確保 hw-now 的 box-shadow 不被裁切

### 6. 全站捲軸
- `shared.css` 集中管理捲軸樣式，移除各 CSS 散落的 `scrollbar-width: thin`

### 7. 色彩模式預設 auto
- 無 `color-mode` key 時（首次使用者），跟隨系統偏好，而非固定亮色

### 8. edit/setting 底色
- 與首頁 `.container` 視覺一致，使用 `--card-bg`
