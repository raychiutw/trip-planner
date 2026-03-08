## 1. Sticky Nav 修正

- [x] 1.1 `css/style.css`：`.dh-nav` 加 `padding: 2px 0`，修正 Day pill 圓角裁切
- [x] 1.2 `css/style.css`：桌面版（≥768px）`.nav-brand` 與 `.nav-actions` 設定相同 `min-width`，使 pills 視覺置中
- [x] 1.3 `css/style.css`：新增 `body.dark .sticky-nav { border-bottom-color: rgba(255,255,255,0.15); }` 加深深色模式底線

## 2. Timeline 旗標合併

- [x] 2.1 `js/app.js`：`renderTimelineEvent()` 的 arrive flag 內，若 `parsed.end` 存在則顯示 `start-end` 格式
- [x] 2.2 `js/app.js`：移除 departure flag（`tl-flag-depart`）的 HTML 輸出
- [x] 2.3 `css/style.css`：移除 `.tl-flag-depart` 相關樣式

## 3. Transit 箭頭移除

- [x] 3.1 `js/app.js`：移除 `.tl-transit-arrow` 的 HTML render
- [x] 3.2 `css/style.css`：移除 `.tl-transit-arrow` 相關樣式

## 4. 測試更新

- [x] 4.1 更新 timeline render 相關 unit test：驗證合併旗標格式、無 depart flag、無 transit arrow
- [x] 4.2 執行全部測試確認無回歸
