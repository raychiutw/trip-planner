## 1. sticky-nav 修正

- [ ] 1.1 刪除 `menu.css` 中 `.sidebar.collapsed ~ .container .sticky-nav .dh-menu { display: flex }` 規則
- [ ] 1.2 在 `edit.css` 加入 `@media (min-width: 768px) { .edit-page .sticky-nav { display: none } }`
- [ ] 1.3 在 `setting.css` 加入 `@media (min-width: 768px) { .setting-page .sticky-nav { display: none } }`

## 2. map-link 統一

- [ ] 2.1 `style.css`：將 `.map-link` 背景改為 `transparent`，移除 `.map-link.mapcode` 的獨立背景色
- [ ] 2.2 `style.css`：統一 `.map-link:hover` 為 `background: #333; color: #fff`
- [ ] 2.3 `style.css`：深色模式 `.map-link:hover` 為 `background: #5A5651; color: #fff`，移除其他深色 map-link 覆蓋

## 3. timeline 圓點對齊

- [ ] 3.1 修正 `style.css` 的 `.tl-event::before` 的 `left` 值，消除水平偏移

## 4. 天氣收合優化

- [ ] 4.1 `style.css`：`.hw-summary` 的 `justify-content` 從 `space-between` 改為 `flex-start`，加 `gap` 控制間距
- [ ] 4.2 `app.js`：天氣收合箭頭從 `▸`（旋轉）改為 `+`/`-` 文字符號
- [ ] 4.3 更新天氣收合相關單元測試（箭頭符號變更）

## 5. hw-now 框線修復

- [ ] 5.1 `style.css`：`.hw-grid` 加 `padding-top: 2px`

## 6. 全站自訂捲軸

- [ ] 6.1 `shared.css`：加入全域 Webkit `::-webkit-scrollbar` 樣式（6px、圓角、亮色滑塊 `#C4C0BB`）
- [ ] 6.2 `shared.css`：加入全域 Firefox `scrollbar-width` + `scrollbar-color` 樣式
- [ ] 6.3 `shared.css`：`body.dark` 區塊加入深色捲軸滑塊 `#5A5651`
- [ ] 6.4 移除 `style.css`、`edit.css`、`menu.css` 中散落的 `scrollbar-width: thin` 宣告

## 7. 色彩模式預設 auto

- [ ] 7.1 `shared.js`：修改 IIFE else 分支，無 `color-mode` key 時使用 `matchMedia('(prefers-color-scheme: dark)')` 判斷
- [ ] 7.2 更新色彩模式初始化相關單元測試

## 8. edit/setting 底色

- [ ] 8.1 `edit.css`：`.edit-page` 加 `background: var(--card-bg)`
- [ ] 8.2 `setting.css`：`.setting-page` 加 `background: var(--card-bg)`

## 9. 驗證

- [ ] 9.1 執行全部測試確認通過
