## ADDED Requirements

### Requirement: R1 料理偏好詢問
`/tp-rebuild` 為某行程產生餐廳推薦前，SHALL 先讀取 JSON `meta.foodPreferences`；若欄位存在且非空則直接採用，否則詢問使用者並將回答寫回 JSON。後續推薦的第 1 家餐廳 SHALL 對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。

#### Scenario: JSON 已有偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 為非空陣列
- **THEN** SHALL 直接採用，不詢問使用者

#### Scenario: JSON 無偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 不存在或為空陣列
- **THEN** SHALL 詢問「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得回答後 SHALL 寫回 `meta.foodPreferences`

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 某 restaurants infoBox 包含多家餐廳推薦
- **THEN** 第 1 家 SHALL 對應偏好 index 0、第 2 家對應 index 1、第 3 家對應 index 2

#### Scenario: R1/R3 category 嚴格對齊
- **WHEN** restaurants infoBox 中的餐廳按順序排列
- **THEN** 每家餐廳的 `category` SHALL 包含對應 `meta.foodPreferences` 的關鍵字（index 0 對齊偏好 0、index 1 對齊偏好 1、index 2 對齊偏好 2）
- **AND** 不符合時 SHALL 以紅燈（fail）標示

#### Scenario: 偏好料理不可得時
- **WHEN** 某偏好料理在行程地點附近找不到評價足夠的餐廳
- **THEN** SHALL 以行程地點附近評價最高的餐廳補位，並在 `notes` 欄位標註「當地無符合偏好之選項，改推薦{實際料理類型}」

### Requirement: R2 餐次完整性
每日 timeline SHALL 包含午餐和晚餐。若缺少，SHALL 插入「餐廳未定」timeline entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等含導遊的固定行程包）不補午餐，晚餐依到達地點推薦。**航程到達日與出發日 SHALL 依航班時間判斷餐次需求**：到達日以到達時間、出發日以出發時間為基準，11:30 前到達/出發影響午餐、17:00 前影響晚餐。無 flights 資料時退回每日皆須午晚餐的傳統檢查。

#### Scenario: 缺午餐補齊
- **WHEN** 某日 timeline 無午餐 entry 且非一日遊團且非航程豁免日
- **THEN** SHALL 在適當時間點插入 `{ title: "午餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 缺晚餐補齊
- **WHEN** 某日 timeline 無晚餐 entry 且非航程豁免日
- **THEN** SHALL 在適當時間點插入 `{ title: "晚餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 一日遊團午餐 entry
- **WHEN** 某日行程為 KKday/Klook 等一日遊團體行程
- **THEN** SHALL 插入午餐 timeline entry，`title` 為「午餐（團體行程已含）」，不附 `infoBoxes[type=restaurants]`
- **AND** 晚餐依團體行程結束後到達地點推薦

#### Scenario: 去程到達日餐次判斷
- **WHEN** 行程含 flights 且該日為去程到達日
- **THEN** 到達時間 < 11:30 → 須補午餐 + 晚餐；11:30 ≤ 到達 < 17:00 → 須補晚餐；≥ 17:00 → 晚餐可選

#### Scenario: 回程出發日餐次判斷
- **WHEN** 行程含 flights 且該日為回程出發日
- **THEN** 出發時間 < 11:30 → 不需午晚餐；11:30 ≤ 出發 < 17:00 → 須有午餐；≥ 17:00 → 須有午餐 + 晚餐

#### Scenario: 無 flights 退回傳統檢查
- **WHEN** 行程 JSON 不含 flights 或無法解析到達/出發時間
- **THEN** SHALL 退回每日皆須午餐 + 晚餐的傳統檢查

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
景點 `infoBoxes` SHALL 包含營業時間資訊，且與到訪時間吻合。

#### Scenario: 景點含營業時間
- **WHEN** 景點有營業時間限制
- **THEN** `infoBoxes` 中 SHALL 包含營業時間項目，且 MUST 確認與行程安排的到訪時間吻合

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

### Requirement: R8 早餐欄位
每日 hotel 物件 SHALL 包含 `breakfast` 欄位，記錄該飯店早餐安排。使用者可指定飯店含早餐或自行解決；未指定時標記為「資料未提供」。若查得到飯店退房時間，SHALL 以 `checkout` 欄位記錄。

#### Scenario: 飯店含早餐
- **WHEN** 使用者指定飯店含早餐
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": true, "note": "早餐說明（如料理類型）" }`

#### Scenario: 自行解決早餐
- **WHEN** 使用者指定自行解決早餐
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": false }`

#### Scenario: 資料未提供
- **WHEN** 使用者未指定早餐安排
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": null }`，顯示「早餐：資料未提供」

#### Scenario: 退房時間
- **WHEN** 可查到飯店最後退房時間
- **THEN** `hotel.checkout` SHALL 記錄退房時間字串（如 `"11:00"`）

#### Scenario: 退房時間未知
- **WHEN** 無法查到飯店退房時間
- **THEN** `hotel.checkout` SHALL 不存在（選填欄位）

### Requirement: R9 AI 亮點精簡
`highlights.content.summary` SHALL 為 50 字以內的旅程風格評語，不列舉具體景點或行程細節。`tags` 陣列保持不變。

#### Scenario: 字數限制
- **WHEN** 產生或修改 `highlights.content.summary`
- **THEN** 字數（中英文字元含標點，不含空白）SHALL ≤ 50

#### Scenario: 不列舉景點
- **WHEN** 撰寫 summary
- **THEN** SHALL 不包含 "Day X" 開頭的行程列舉、不列舉具體景點名稱或交通方式

#### Scenario: 風格評語
- **WHEN** 撰寫 summary
- **THEN** SHALL 以旅程整體風格、特色、適合對象等角度撰寫評語

### Requirement: R10 還車加油站
自駕行程產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。優先推薦フルサービス（人工加油站）。加油站以 `gasStation` infoBox 結構化呈現，欄位直接位於 infoBox 頂層（扁平結構），包含名稱、地址、營業時間、服務類型（人工/自助）、電話。

#### Scenario: 新增還車事件
- **WHEN** 為自駕行程新增還車 timeline event
- **THEN** SHALL 搜尋還車店鋪附近的加油站（Google「{還車地點} 附近 人工加油站」），以 `gasStation` infoBox 附上

#### Scenario: 人工優先
- **WHEN** 推薦加油站
- **THEN** SHALL 優先選擇フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`
- **AND** 若附近僅有自助加油站，標註 `service: "セルフ（自助）"`

#### Scenario: 必填資訊
- **WHEN** 新增 gasStation infoBox
- **THEN** SHALL 填寫 `name`、`address`、`hours`、`service`、`phone`、`location`（MapLocation 物件，含 googleQuery / appleQuery），所有欄位直接位於 infoBox 頂層

#### Scenario: gasStation 扁平結構
- **WHEN** 新增或修改 gasStation infoBox
- **THEN** SHALL 不使用 `station` wrapper，所有欄位（name、address、hours、service、phone、location）直接位於 infoBox 頂層

### Requirement: R11 地圖導航

所有景點、餐廳、加油站 SHALL 包含 location 欄位，確保使用者可直接開啟地圖導航。location 物件 SHALL 遵循 MapLocation 統一型別。R11 採 strict 級（紅燈），缺失時中斷測試。

#### Scenario: timeline event 須有 location
- **WHEN** timeline event 為實體地點（非交通、非餐廳未定、非純描述事件）
- **THEN** SHALL 包含 `locations[]` 陣列，至少一個 MapLocation 物件

#### Scenario: restaurant 須有 location
- **WHEN** restaurants infoBox 中的任一餐廳
- **THEN** SHALL 包含 `location` 物件（MapLocation 型別）

#### Scenario: gasStation 須有 location
- **WHEN** gasStation infoBox 存在
- **THEN** SHALL 包含 `location` 物件（MapLocation 型別）

#### Scenario: shop location 為建議性
- **WHEN** shopping infoBox 中的任一 shop
- **THEN** SHOULD 包含 `location` 物件，但不強制（現有資料填寫率不足，以 warn 模式提醒）

#### Scenario: travel event 略過 R11
- **WHEN** timeline event 含 `travel` 物件（交通移動資訊）
- **THEN** SHALL 略過 R11 檢查

#### Scenario: 餐廳未定 event 略過 R11
- **WHEN** timeline event title 包含「餐廳未定」
- **THEN** SHALL 略過 R11 檢查

#### Scenario: location 缺失時 fail
- **WHEN** 實體地點 event 不含 `location`
- **THEN** tp-check SHALL 以紅燈（fail）標示

### Requirement: R12 Google 評分

所有 POI（實體地點類 timeline event、餐廳、商店、加油站）SHALL 含 `googleRating` 欄位（數字，1.0-5.0）。R12 採 strict 級（紅燈），缺失時中斷測試。頁面渲染 SHALL 在 POI 名稱旁顯示 `★ {rating}` 格式的評分。

#### Scenario: 景點含 googleRating
- **WHEN** timeline event 為實體地點
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 餐廳含 googleRating
- **WHEN** restaurant 物件存在
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 商店含 googleRating
- **WHEN** shop 物件存在
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 加油站含 googleRating
- **WHEN** gasStation infoBox 存在
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: travel event 略過 R12
- **WHEN** timeline event 含 `travel` 物件（交通移動資訊）
- **THEN** SHALL 略過 R12 檢查

#### Scenario: 餐廳未定 event 略過 R12
- **WHEN** timeline event title 包含「餐廳未定」
- **THEN** SHALL 略過 R12 檢查

#### Scenario: googleRating 缺失時 fail
- **WHEN** 實體地點 event、餐廳、商店或加油站不含 `googleRating`
- **THEN** tp-check SHALL 以紅燈（fail）標示

#### Scenario: 景點渲染 rating
- **WHEN** renderTimelineEvent 渲染含 googleRating 的景點
- **THEN** SHALL 在標題旁顯示 `★ {rating}`（一位小數）

#### Scenario: 餐廳渲染 rating
- **WHEN** renderRestaurant 渲染含 googleRating 的餐廳
- **THEN** SHALL 在名稱行顯示 `★ {rating}`（一位小數）

#### Scenario: 商店渲染 rating
- **WHEN** renderShop 渲染含 googleRating 的商店
- **THEN** SHALL 在名稱行顯示 `★ {rating}`（一位小數）

#### Scenario: 加油站渲染 rating
- **WHEN** renderInfoBox 渲染含 googleRating 的 gasStation
- **THEN** SHALL 在標題旁顯示 `★ {rating}`（一位小數）

#### Scenario: 無 rating 時不顯示
- **WHEN** POI 的 googleRating 不存在或非數字
- **THEN** SHALL 不顯示任何評分標示

### Requirement: tp-rebuild 品質檢查整合

`/tp-rebuild` 全面重整單一行程 JSON 時，SHALL 在修正前後各執行一次 tp-check 品質驗證 report。修正前的 report 用於識別需修正項目，修正後的 report 用於確認修正結果。

#### Scenario: 修正前 tp-check

- **WHEN** `/tp-rebuild {tripSlug}` 開始執行
- **THEN** SHALL 先執行 tp-check 完整模式（before-fix report）
- **AND** 顯示完整 report 供參照

#### Scenario: 修正後 tp-check

- **WHEN** `/tp-rebuild` 完成所有修正
- **THEN** SHALL 再執行一次 tp-check 完整模式（after-fix report）
- **AND** 顯示完整 report 確認修正結果

#### Scenario: tp-rebuild-all 整合

- **WHEN** `/tp-rebuild-all` 逐趟執行重整
- **THEN** 每趟完成後 SHALL 執行一次 tp-check 完整模式（after-fix report）

#### Scenario: 修正前備份

- **WHEN** `/tp-rebuild` 即將修改行程 JSON
- **THEN** SHALL 先執行備份流程（見 trip-json-backup spec）
