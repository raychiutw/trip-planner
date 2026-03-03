## 1. 標題列

- [x] 1.1 `setting.html`：在 `.sticky-nav` 內漢堡按鈕後加入 `<span class="nav-title">設定</span>`
- [x] 1.2 `css/setting.css`：移除 `.sticky-nav { display: none }`，改為顯示並設 `background: var(--card-bg)`
- [x] 1.3 `css/setting.css`：桌機版隱藏漢堡按鈕 `@media (min-width: 768px) { .setting-main .sticky-nav .dh-menu { display: none } }`

## 2. 版面結構統一

- [x] 2.1 `css/setting.css`：`.setting-page` 移除 `background: var(--card-bg)`
- [x] 2.2 `css/setting.css`：`.setting-page` 桌機版 `max-width` 從 `640px` 改為 `60vw`

## 3. Active 色碼統一

- [x] 3.1 `css/setting.css`：`.color-mode-card.active` 的 `border-color` 和 `box-shadow` 從 `var(--blue)` 改為 `var(--accent)`

## 4. 測試驗證

- [x] 4.1 執行 `npm test` 確認 unit/integration 測試全過
- [x] 4.2 執行 `npm run test:e2e` 確認 E2E 測試全過
