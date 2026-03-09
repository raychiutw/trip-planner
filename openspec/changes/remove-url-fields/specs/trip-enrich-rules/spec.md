## MODIFIED Requirements

### Requirement: R3 餐廳推薦品質
每個 `infoBoxes[type=restaurants]` 的 `restaurants` 陣列 SHALL 補到 3 家。每家餐廳 SHALL 包含 `hours`（營業時間）、`reservation`（訂位資訊）。推薦餐廳的營業時間 MUST 與用餐時間吻合。選擇依據為行程當時地點附近、評價高的餐廳。餐廳的料理類別 SHALL 對齊 `meta.foodPreferences` 的優先順序排列。

#### Scenario: 餐廳數量規則
- **WHEN** 某 restaurants infoBox 的 `restaurants` 陣列
- **THEN** 數量 SHALL ≥ 1 且 ≤ 3
- **AND** 使用者已提供的餐廳資料優先保留，不強制補到 3 家
- **AND** 若使用者未提供任何餐廳，SHALL 以行程當時位置附近、評價高為條件補足到 3 家，每家依料理偏好排序

#### Scenario: category 對齊偏好順序
- **WHEN** 補齊或新增餐廳至 restaurants infoBox
- **THEN** 餐廳陣列中各家的料理類別 SHALL 依序對應 `meta.foodPreferences` index 0、1、2

#### Scenario: 營業時間吻合
- **WHEN** 推薦午餐餐廳
- **THEN** 該餐廳的 `hours` MUST 涵蓋午餐時段（不得推薦 17:00 才開的店當午餐）

#### Scenario: 必填欄位完整
- **WHEN** 新增任一餐廳
- **THEN** SHALL 填寫 `hours`、`reservation`（需訂位/不需訂位/電話等）

### Requirement: R4 景點品質
景點 `infoBoxes` SHALL 包含營業時間資訊。

#### Scenario: 景點含營業時間
- **WHEN** 景點有營業時間限制
- **THEN** `infoBoxes` 中 SHALL 包含營業時間項目，且 MUST 確認與行程安排的到訪時間吻合

### Requirement: R5 飯店品質
Hotel 物件 SHALL 包含 `checkout` 退房時間（選填）與 `breakfast` 早餐資訊。

#### Scenario: 退房時間
- **WHEN** 可查到飯店最後退房時間
- **THEN** `hotel.checkout` SHALL 記錄退房時間字串（如 `"11:00"`）

#### Scenario: 退房時間未知
- **WHEN** 無法查到飯店退房時間
- **THEN** `hotel.checkout` SHALL 不存在（選填欄位）

### Requirement: R7 購物景點推薦
飯店附近有超市、唐吉軻德、超商等購物點時，SHALL 以 `infoBox type=shopping` 結構化顯示。停車場資訊 SHALL 以 `parking` infoBox 寫入 `hotel.infoBoxes[]`。獨立購物行程（來客夢/iias/Outlet/PARCO CITY/購物商圈）同樣 SHALL 附 shopping infoBox。景點附近步行 5~10 分鐘內有超市或唐吉軻德時，SHALL 在該景點 timeline entry 加 shopping infoBox。每個購物景點 SHALL 包含 `mustBuy` 必買推薦。渲染 SHALL 復用既有 `.restaurant-choice` CSS，不新增 CSS。所有 shop item 不含 `titleUrl`。不再使用 `souvenir` infoBox type，統一為 `shopping`。

#### Scenario: 飯店附近購物 infoBox
- **WHEN** 飯店附近有超市、唐吉軻德、超商或其他購物點
- **THEN** 該飯店的 timeline entry SHALL 包含 `infoBox type=shopping`，每個 shop 含 `category`、`name`、`hours`、`mustBuy[]`（至少 3 項）

#### Scenario: 飯店附近超商
- **WHEN** 飯店步行 5 分鐘內有便利商店（7-11、FamilyMart、Lawson 等）
- **THEN** SHALL 以 shop entry 記錄，category 為「超商」，含 `mustBuy`（當地限定商品推薦）

#### Scenario: 自駕飯店停車場
- **WHEN** 行程為自駕且飯店有停車場
- **THEN** 飯店的 `hotel.infoBoxes[]` SHALL 包含 `type: "parking"` 的 infoBox，含停車場資訊（費用 + 地點）
- **AND** 若有附加說明，SHALL 寫入 `note` 欄位

#### Scenario: 獨立購物行程 infoBox
- **WHEN** timeline 中有購物類景點（來客夢、iias、Outlet、PARCO CITY、購物商圈等）
- **THEN** 該 timeline entry SHALL 包含 `infoBox type=shopping`，每個 shop 含 `category`、`name`、`hours`、`mustBuy[]`（至少 3 項）

#### Scenario: 景點附近超市/唐吉軻德
- **WHEN** 景點步行 5~10 分鐘內有超市或唐吉軻德
- **THEN** 該景點 timeline entry SHALL 包含 shopping infoBox，列出附近的超市/唐吉軻德 shop entry

#### Scenario: mustBuy 必買推薦
- **WHEN** 新增任一 shopping infoBox 的 shop
- **THEN** SHALL 填寫 `mustBuy` 陣列（至少 3 項推薦商品/品類）

#### Scenario: shop 不含 titleUrl
- **WHEN** 新增任一 shop entry
- **THEN** SHALL 不包含 `titleUrl` 欄位

#### Scenario: 統一 shopping type
- **WHEN** 行程 JSON 有購物相關 infoBox
- **THEN** SHALL 使用 `type: "shopping"` 搭配 `shops[]` 陣列，不使用 `type: "souvenir"`

#### Scenario: renderPlace 復用既有 CSS
- **WHEN** app.js 渲染 shopping infoBox
- **THEN** SHALL 使用 `renderPlace()` 函式，復用 `.restaurant-choice` CSS class，不新增任何 CSS

#### Scenario: 飯店購物 infoBox 生成
- **WHEN** 飯店物件的 `infoBoxes` 不存在或不含 `type=shopping`
- **THEN** SHALL 新建 `infoBoxes` 陣列（若不存在）並加入 `type=shopping` infoBox
- **AND** SHALL 搜尋飯店附近超市/超商/唐吉軻德，補到 3+ shops
- **AND** shopping infoBox SHALL 放在 `hotel.infoBoxes`，不放在 timeline entry

#### Scenario: 飯店購物 infoBox 兩階段 checklist
- **WHEN** 執行 R7 檢查
- **THEN** SHALL 先執行「驗證既有」（category 標準化、欄位完整性），再執行「生成缺漏」（逐日檢查每間飯店是否有 shopping infoBox，缺者新建）

## REMOVED Requirements

### Requirement: R6 搜尋方式
**Reason**: R6 僅服務 blogUrl 搜尋邏輯，blogUrl 欄位已全面移除
**Migration**: 無需遷移，移除所有 blogUrl 搜尋相關程式碼與品質規則即可
