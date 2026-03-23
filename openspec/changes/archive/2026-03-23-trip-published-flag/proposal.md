## Why

目前所有行程在設定頁、編輯頁、manage 頁都全部顯示，無法區分「進行中/已完成」與「已停用/測試中」的行程。需要一個上架/下架機制，讓下架行程不再出現在一般使用者介面，但管理端仍可存取。

## What Changes

- `meta.md` 新增 `published` 欄位（boolean），控制行程是否上架
- `trips.json` registry 帶入 `published` 欄位
- 設定頁（`setting.js`）只顯示 `published: true` 的行程
- 行程主頁（`app.js`）若 localStorage 選到下架行程，顯示「此行程已下架」提示並導到設定頁
- manage 頁（`manage.js`）只顯示上架行程
- admin 頁（`admin.js`）顯示全部行程，下架行程標題前加 `(已下架)` 前綴
- 行程篩選下拉選單統一用行程 `name` 顯示
- MimiChu、RayHus 標記為下架，其餘 5 個行程上架

## Capabilities

### New Capabilities
- `trip-published`: 行程上架/下架 flag 機制，涵蓋資料層（meta.md → trips.json）與各頁面過濾邏輯

### Modified Capabilities

## Impact

- **資料層**：`data/trips-md/*/meta.md`（7 個）、`data/examples/meta.md`、`scripts/trip-build.js`、`scripts/build.js`
- **前端**：`js/setting.js`、`js/app.js`、`js/manage.js`、`js/admin.js`
- **測試**：schema / registry / quality 測試可能需更新以涵蓋 `published` 欄位
