## 1. renderHotel 渲染補齊

- [x] 1.1 renderHotel 新增 hotel.infoBoxes 渲染：迴圈 `hotel.infoBoxes` 呼叫既有 `renderInfoBox(box)`，放在 subs 之後
- [x] 1.2 renderHotel 新增 breakfast 渲染：在 details 之後顯示早餐狀態（included=true/false/null 三種文字），使用 `iconSpan('utensils')`
- [x] 1.3 renderHotel 新增 checkout 渲染：在 breakfast 之後顯示「退房 {time}」，使用 `iconSpan('clock')`，僅 checkout 存在時才渲染

## 2. hotel.subs 格式統一

- [x] 2.1 renderHotel subs 渲染改讀新格式：讀取 `sub.type`/`sub.title`/`sub.price`/`sub.note`/`sub.location`（取代舊的 label/text/items）
- [x] 2.2 Ray JSON：4 處舊格式 `{label, text, location}` 轉為新格式 `{type: "parking", title, price, location, note}`

## 3. HuiYun 購物搬遷

- [x] 3.1 HuiYun JSON：6 處 `subs[type=shopping]` 搬到 `hotel.infoBoxes[type=shopping]`，subs 僅留 parking；搬遷後若 subs 為空則移除
- [x] 3.2 HuiYun JSON：5 處缺 checkout 的 hotel 補上 checkout 欄位

## 4. 移除無用 JSON 欄位

- [x] 4.1 四個行程檔移除 `meta.themeColor`
- [x] 4.2 四個行程檔移除 `meta.name`

## 5. 資料一致性修正

- [x] 5.1 RayHus JSON：2 處 hotel 補 checkout（THE NEST NAHA Day 4/5；Day 1~3 Living Inn 已有 checkout，url 也已存在）
- [x] 5.2 Ray JSON：3 個缺 category 的餐廳補上 category（潛水體驗）

## 6. 測試更新與驗證

- [x] 6.1 schema.test.js 新增 hotel.subs 新格式結構驗證（SHALL 含 type + title，SHALL 不含 label/text）
- [x] 6.2 schema.test.js 新增 meta 驗證（SHALL 不含 themeColor/name）
- [x] 6.3 執行全部測試確認通過（npm test）— 393 tests passed
