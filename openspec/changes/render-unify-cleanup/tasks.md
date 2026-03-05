## Task Groups

### 1. renderPlace 合併

- [x] 1.1 在 app.js 中新增 `renderPlace(item)` 函式，合併 `renderRestaurant` 與 `renderShop` 的邏輯：共用 `.restaurant-choice` 結構、`renderMapLinks`、`renderBlogLink`；透過欄位偵測決定是否渲染 `desc`/`price`/`url` 連結（餐廳欄位）與 `mustBuy[]`/`reservation` 區塊（商店/訂位欄位）
- [x] 1.2 更新 `renderInfoBox` 的 `case 'restaurants'`：將 `renderRestaurant(r)` 呼叫改為 `renderPlace(r)`
- [x] 1.3 更新 `renderInfoBox` 的 `case 'shopping'`：將 `renderShop(s)` 呼叫改為 `renderPlace(s)`
- [x] 1.4 刪除 app.js 中原本的 `renderRestaurant` 函式（第 53–83 行）與 `renderShop` 函式（第 86–105 行）

### 2. souvenir 清理

- [x] 2.1 刪除 `renderInfoBox` 中 `case 'souvenir'` 整段（第 129–147 行，約 20 行）

### 3. Exports 更新

- [x] 3.1 更新 `window.TripApp` exports：移除 `renderRestaurant` 與 `renderShop`，新增 `renderPlace`

### 4. 驗證

- [x] 4.1 執行 `npm test`，確認所有測試全數通過
