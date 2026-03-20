## 1. 資料層

- [x] 1.1 所有 7 個行程的 `meta.md` 加入 `published` 欄位（MimiChu、RayHus 設 `false`，其餘 `true`）
- [x] 1.2 `data/examples/meta.md` 加入 `published` 欄位範例
- [x] 1.3 `scripts/trip-build.js` 解析 `published` 到 meta.json（未指定預設 `true`）
- [x] 1.4 `scripts/build.js` 聚合時將 `published` 帶入 trips.json registry

## 2. 前端過濾

- [x] 2.1 `js/setting.js` 過濾只顯示 `published: true` 的行程
- [x] 2.2 `js/app.js` 偵測下架行程：顯示「此行程已下架」提示 → 2 秒後導到 setting.html
- [x] 2.3 `js/manage.js` 行程選擇只顯示上架行程，用 `name` 顯示
- [x] 2.4 `js/admin.js` 顯示全部行程，下架的加 `(已下架)` 前綴，用 `name` 顯示

## 3. 測試與驗證

- [x] 3.1 `npm run build` 確認 trips.json 包含 `published` 欄位
- [x] 3.2 更新 schema/registry 測試涵蓋 `published` 欄位
- [x] 3.3 `npm test` 全過
