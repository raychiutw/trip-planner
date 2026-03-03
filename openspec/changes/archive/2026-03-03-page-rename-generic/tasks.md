## 1. js/app.js — buildMenu() 名稱替換

- [x] 1.1 `js/app.js`：`buildMenu()` drawer section（`#menuGrid`）將 `' 行程頁'` 改為 `' 我的行程'`
- [x] 1.2 `js/app.js`：`buildMenu()` drawer section 將 `' 編輯頁'` 改為 `' 編輯行程'`
- [x] 1.3 `js/app.js`：`buildMenu()` drawer section 將 `' 設定頁'` 改為 `' 設定'`
- [x] 1.4 `js/app.js`：`buildMenu()` sidebar section（`#sidebarNav`）將可見文字與 `title` 屬性中的 `行程頁` 改為 `我的行程`（共 2 處：`title="..."` 與 `item-label` span）
- [x] 1.5 `js/app.js`：`buildMenu()` sidebar section 將 `編輯頁` 改為 `編輯行程`（共 2 處）
- [x] 1.6 `js/app.js`：`buildMenu()` sidebar section 將 `設定頁` 改為 `設定`（共 2 處）

## 2. js/edit.js — buildEditMenu() 名稱替換

- [x] 2.1 `js/edit.js`：`buildEditMenu()` drawer section 將 `' 行程頁'` 改為 `' 我的行程'`
- [x] 2.2 `js/edit.js`：`buildEditMenu()` drawer section 將 `' 編輯頁'` 改為 `' 編輯行程'`
- [x] 2.3 `js/edit.js`：`buildEditMenu()` drawer section 將 `' 設定頁'` 改為 `' 設定'`
- [x] 2.4 `js/edit.js`：`buildEditMenu()` sidebar section 將 `行程頁` 改為 `我的行程`（title 屬性 + item-label span，共 2 處）
- [x] 2.5 `js/edit.js`：`buildEditMenu()` sidebar section 將 `編輯頁` 改為 `編輯行程`（共 2 處）
- [x] 2.6 `js/edit.js`：`buildEditMenu()` sidebar section 將 `設定頁` 改為 `設定`（共 2 處）

## 3. js/setting.js — buildSettingMenu() 名稱替換

- [x] 3.1 `js/setting.js`：`buildSettingMenu()` drawer section 將 `' 行程頁'` 改為 `' 我的行程'`
- [x] 3.2 `js/setting.js`：`buildSettingMenu()` drawer section 將 `' 編輯頁'` 改為 `' 編輯行程'`
- [x] 3.3 `js/setting.js`：`buildSettingMenu()` drawer section 將 `' 設定頁'` 改為 `' 設定'`
- [x] 3.4 `js/setting.js`：`buildSettingMenu()` sidebar section 將 `行程頁` 改為 `我的行程`（title 屬性 + item-label span，共 2 處）
- [x] 3.5 `js/setting.js`：`buildSettingMenu()` sidebar section 將 `編輯頁` 改為 `編輯行程`（共 2 處）
- [x] 3.6 `js/setting.js`：`buildSettingMenu()` sidebar section 將 `設定頁` 改為 `設定`（共 2 處）

## 4. index.html — meta 標籤通用化

- [x] 4.1 `index.html` line 7：`meta[name=description]` content 改為「旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。」
- [x] 4.2 `index.html` line 9：`meta[property=og:title]` content 改為「Trip Planner」
- [x] 4.3 `index.html` line 10：`meta[property=og:description]` content 改為「旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。」
- [x] 4.4 `index.html` line 13：`<title>` 改為「Trip Planner」

## 5. edit.html — title 標籤更新

- [x] 5.1 `edit.html` line 8：`<title>` 從「AI 修改行程 — Trip Planner」改為「編輯行程 — Trip Planner」

## 6. 測試更新

- [x] 6.1 `tests/e2e/edit-page.spec.js` line 204：`expect(settingHref).toContain('設定頁')` 改為 `expect(settingHref).toContain('設定')`

## 7. 驗證

- [x] 7.1 執行 `npm test`（Vitest 單元測試）確認全數通過
- [x] 7.2 執行 E2E 測試（`npx playwright test`）確認全數通過
- [x] 7.3 手動開啟 `index.html`：drawer 選單與側邊欄顯示「我的行程」、「編輯行程」、「設定」
- [x] 7.4 手動開啟 `edit.html`：瀏覽器 tab 標題顯示「編輯行程 — Trip Planner」；選單與側邊欄顯示正確新名稱
- [x] 7.5 手動開啟 `setting.html`：選單與側邊欄顯示正確新名稱
- [x] 7.6 手動查看 `index.html` 原始碼：meta description、og:title、og:description、title 標籤均無「沖繩」
