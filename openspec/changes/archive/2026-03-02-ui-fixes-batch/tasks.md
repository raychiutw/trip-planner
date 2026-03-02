# ui-fixes-batch Tasks

## 1. sticky-nav 修正

- [x] 1.1 刪除 `menu.css` 中 `.sidebar.collapsed ~ .container .sticky-nav .dh-menu { display: flex }` 規則
- [x] 1.2 在 `edit.css` 加入 `@media (min-width: 768px) { .edit-page .sticky-nav { display: none } }`
- [x] 1.3 在 `setting.css` 加入 `@media (min-width: 768px) { .setting-page .sticky-nav { display: none } }`

## 2. map-link 統一

- [x] 2.1 `.map-link` 背景改為 `transparent`，移除 `.map-link.mapcode` 的獨立背景色
- [x] 2.2 統一 `.map-link:hover` 為 `background: #333; color: #fff`
- [x] 2.3 深色模式 hover 為 `background: #5A5651; color: #fff`，移除其他深色 map-link 覆蓋

## 3. timeline 圓點對齊

- [x] 3.1 修正 `.tl-event::before` 的 `left` 值，使圓點中心對齊線中心

## 4. 天氣收合優化

- [x] 4.1 `.hw-summary` 的 `justify-content` 從 `space-between` 改為 `flex-start`，加 `gap` 控制間距
- [x] 4.2 `app.js` 中天氣收合箭頭改為 `+`（收合）/ `-`（展開）
- [x] 4.3 更新相關單元測試中的 `▸`（無測試參照，略）

## 5. hw-now 框線修復

- [x] 5.1 `.hw-grid` 加 `padding-top: 2px`

## 6. 全站自訂捲軸

- [x] 6.1 `shared.css` 加入 Webkit scrollbar 樣式（6px、圓角、亮色滑塊 `#C4C0BB`）
- [x] 6.2 `shared.css` 加入 Firefox `scrollbar-width: thin; scrollbar-color: #C4C0BB transparent;`
- [x] 6.3 `body.dark` 加入深色捲軸 `#5A5651`
- [x] 6.4 移除 style.css、edit.css、menu.css 中散落的 `scrollbar-width: thin`

## 7. 色彩模式預設 auto

- [x] 7.1 `shared.js` IIFE：無 `color-mode` key 時用 `matchMedia('(prefers-color-scheme: dark)')` 判斷
- [x] 7.2 更新相關單元測試（無測試參照，略）

## 8. edit/setting 底色

- [x] 8.1 `.edit-page` 加 `background: var(--card-bg)`
- [x] 8.2 `.setting-page` 加 `background: var(--card-bg)`

## 9. 驗證

- [x] 9.1 執行 `npx vitest run` 確認通過（250 tests passed）
