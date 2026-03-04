## Tasks

### 1. reservation: null → "不需訂位"

- [x] 1.1 Ray JSON：16 處 `reservation: null` → `"不需訂位"`
- [x] 1.2 RayHus JSON：10 處 `reservation: null` → `"不需訂位"`
- [x] 1.3 Onion JSON：66 處 `reservation: null` → `"不需訂位"`

### 2. 空 breakfast.note 移除

- [x] 2.1 Ray JSON：3 處移除 `"note": ""`
- [x] 2.2 RayHus JSON：0 處（已無空 note，無需修改）

### 3. HuiYun 停車場 subs 補 price

- [x] 3.1 HuiYun JSON：6 處飯店 parking subs 補 `price` 欄位

### 4. R1 餐廳排序修正

- [x] 4.1 Onion JSON：已正確排序，無需修改
- [x] 4.2 RayHus JSON：1 處實際需修正（Day 4 晚餐 牛排提前對齊偏好）

### 5. 驗證

- [x] 5.1 執行 `npm test` 確認所有測試通過（385 tests passed）
