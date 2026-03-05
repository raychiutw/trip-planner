## D1：合併策略 — 欄位偵測取代 type 參數

`renderPlace(item)` 不接受額外的 opts 或 type 參數，改用欄位偵測（feature detection）決定要渲染哪些區塊：

- 若 `item.mustBuy` 存在且非空 → 渲染必買區塊（商店行為）
- 若 `item.reservation` 存在 → 渲染訂位資訊（餐廳行為）
- 若 `item.url` 存在 → 將名稱渲染為連結（餐廳行為）
- 若 `item.desc` 或 `item.price` 存在 → 渲染描述與價位（餐廳行為）

此設計讓函式天然支援未來可能的混合欄位，無需修改函式簽名。

## D2：函式簽名

```js
function renderPlace(item) { ... }
```

不使用 `renderPlace(item, opts)` 或 `renderPlace(item, type)` 形式。理由：欄位本身即為充分的判斷依據，額外參數增加呼叫複雜度且無必要。

## D3：呼叫點更新

`renderInfoBox` 中兩處呼叫改為 `renderPlace`：

```js
// 原本
rItems.forEach(function(r) { html += renderRestaurant(r); });
sItems.forEach(function(s) { html += renderShop(s); });

// 改後
rItems.forEach(function(r) { html += renderPlace(r); });
sItems.forEach(function(s) { html += renderPlace(s); });
```

## D4：移除 souvenir case — 無向後相容 shim

`case 'souvenir'` 整段直接刪除，不保留任何降級處理或 shim。理由：

1. 現有四份行程 JSON 中零個實例使用 `type: "souvenir"`
2. R7 規格已明確廢棄此類型
3. 保留 shim 會讓死碼繼續存在，違背此次重構的目的

## D5：window.TripApp exports 更新 — 直接替換，不保留別名

從 `window.TripApp` exports 移除 `renderRestaurant` 與 `renderShop`，改為 export `renderPlace`。不建立指向 `renderPlace` 的別名。理由：

1. 這些函式為內部渲染函式，非公開 API
2. 目前無外部模組或測試直接呼叫 `window.TripApp.renderRestaurant` 或 `window.TripApp.renderShop`
3. 保留別名會讓 exports 持續暴露已不存在的函式名稱，造成混淆

## 渲染邏輯對照表

| 欄位 | renderRestaurant | renderShop | renderPlace |
|------|-----------------|------------|-------------|
| category | 顯示 | 顯示 | 顯示（若有） |
| name | 顯示（可為連結） | 顯示 | 顯示（若有 url 則為連結） |
| desc | 顯示 | — | 顯示（若有） |
| price | 顯示 | — | 顯示（若有） |
| location | 地圖連結 | 地圖連結 | 地圖連結（若有） |
| hours | 顯示 | 顯示 | 顯示（若有） |
| reservation | 顯示（可為連結） | — | 顯示（若有，可為連結） |
| reservationUrl | 訂位連結 | — | 訂位連結（若有） |
| blogUrl | 網誌連結 | 網誌連結 | 網誌連結（若有） |
| mustBuy[] | — | 顯示 | 顯示（若有） |
