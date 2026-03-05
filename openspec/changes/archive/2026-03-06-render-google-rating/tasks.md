## 1. JS 渲染：顯示 googleRating

- [x] 1.1 `js/app.js` `renderTimelineEvent()`：在 `tl-title` 後、blogUrl 前插入 `<span class="rating">★ {rating}</span>`（googleRating 存在且為數字時）
- [x] 1.2 `js/app.js` `renderRestaurant()`：在名稱行（category + name）之後、description 之前插入 rating
- [x] 1.3 `js/app.js` `renderShop()`：在名稱行之後插入 rating

## 2. CSS 樣式

- [x] 2.1 `css/style.css` 新增 `.rating` class（顏色 `var(--accent)`、字級 `var(--fs-sm)`、inline 顯示）

## 3. 品質規則升級

- [x] 3.1 `.claude/commands/trip-quality-rules.md`：R12 已為 SHALL/strict（由 quality-strict-enforcement 完成）
- [x] 3.2 `openspec/specs/trip-enrich-rules/spec.md`：已同步更新（由 quality-strict-enforcement 完成）

## 4. 測試

- [x] 4.1 `tests/unit/render.test.js`：新增 renderTimelineEvent 含 googleRating 的測試
- [x] 4.2 `tests/unit/render.test.js`：新增 renderRestaurant 含 googleRating 的測試
- [x] 4.3 `tests/unit/render.test.js`：新增 renderShop 含 googleRating 的測試
- [x] 4.4 render 測試全部通過（quality.test.js 待 rebuild-all 後通過）

## 5. 補齊 JSON 資料

- [x] 5.1 執行 `/tp-rebuild-all` 重掃所有行程，補齊缺少的 googleRating

## 6. 驗證

- [x] 6.1 全域 grep 確認所有行程 JSON 的 POI 都有 googleRating
- [x] 6.2 `npm test` 全部通過（460 tests passed）
