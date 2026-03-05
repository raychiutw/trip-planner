## Why

`renderRestaurant` 與 `renderShop` 兩個函式（app.js 第 53–105 行）結構幾乎完全相同：都產生 `<div class="restaurant-choice">`、都使用 `iconSpan('clock')` 顯示營業時間、都呼叫 `renderMapLinks`、都使用 `renderBlogLink`。兩者的差異僅在於顯示欄位的不同（餐廳有 `desc`、`price`、`url`、`reservation`、`reservationUrl`；商店有 `mustBuy[]`），並非邏輯上的本質差異。

另外，`renderInfoBox` 中的 `case 'souvenir'`（第 129–147 行，約 20 行）處理一個已廢棄的 infoBox 類型。R7 規格明確指出「不再使用 souvenir infoBox type，統一為 shopping」，且現有四份行程 JSON 中零個實例使用此類型。這段程式碼屬於純死碼（dead code）。

## What Changes

1. **合併函式**：將 `renderRestaurant` 與 `renderShop` 合併為單一函式 `renderPlace(item)`，透過欄位偵測（`item.mustBuy` 是否存在、`item.reservation` 是否存在）決定渲染哪些區塊，無需額外的 type 參數。

2. **更新呼叫點**：`renderInfoBox` 中 `case 'restaurants'` 與 `case 'shopping'` 的呼叫改為使用 `renderPlace`。

3. **移除死碼**：刪除 `renderInfoBox` 中 `case 'souvenir'` 整段（約 20 行）。

4. **更新 exports**：`window.TripApp` 的 export 更新為 `renderPlace`，移除原本的 `renderRestaurant` 與 `renderShop`。

## Capabilities

- **MODIFIED**：`trip-enrich-rules` R7 購物景點推薦 — 渲染參考由 `renderShop()` 更新為 `renderPlace()`

## Impact

- **無資料格式變更**：不影響任何行程 JSON 結構
- **無 CSS 變更**：持續復用既有 `.restaurant-choice` CSS class
- **無 checklist / backup / suggestions 影響**：純 JS 層重構
- **window.TripApp exports 異動**：`renderRestaurant` 與 `renderShop` 從 exports 移除，改為 `renderPlace`；由於這些為內部函式，對外部無實質影響
