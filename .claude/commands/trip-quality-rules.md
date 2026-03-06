# 行程品質規則

產生或修改 `data/trips/*.json` 時，必須遵守以下所有品質規則。

### R0 JSON 結構與值約束

#### 值約束
- 行程 JSON 中**禁止使用 `null`**（唯一例外：`hotel.breakfast.included` 允許 `null` 表示「資料未提供」）。找不到的字串欄位用空字串 `""`，找不到的數字欄位省略該欄位，找不到的物件/陣列欄位省略該欄位。`typeof null === "object"` 會導致 schema 測試失敗。
- 每日 `label` **不超過 8 字**。超過時用更簡潔的寫法，例如「甘川洞・松島」而非「甘川洞・松島・南浦」。

#### URL 與格式安全性
- 所有 URL 欄位（titleUrl、url、googleQuery、appleQuery、reservationUrl、blogUrl）的值必須以 `http://`、`https://` 或 `tel:` 開頭，否則視為不安全。
- `googleQuery` 必須為 Google Maps URL（以 `https://maps.google.com/` 或 `https://www.google.com/maps/` 開頭）。
- `appleQuery` 必須為 Apple Maps URL（以 `https://maps.apple.com/` 開頭）。
- `mapcode` 格式為 `XX XXX XXX*XX`（如 `33 530 406*00`），正則：`/^\d{2,4}\s\d{3}\s\d{3}\*\d{2}$/`。

#### 根層級必填欄位
- 必填：`meta`（含 `title` 非空字串、`selfDrive` boolean）、`days`（非空陣列）、`weather`（非空陣列）、`autoScrollDates`（非空陣列）、`footer`（含 `title`、`dates`）、`highlights`、`suggestions`、`checklist`。
- 選填：`flights`、`emergency`（存在時驗證結構）。
- `meta` 不得包含已移除欄位（`themeColor`、`name`）。

#### 每日結構
- 每日必填：`id`、`date`（非空字串）、`label`、`content.timeline`（陣列）。
- `days[i].id` 必須等於 `i + 1`（從 1 開始的連續整數）。
- `weather[].date` 和 `autoScrollDates[]` 須為 ISO 格式 `YYYY-MM-DD`。
- `weather[].locations[].lat` 和 `lon` 須為 number 型別。

#### Timeline event 結構
- 每個 event 必填：`time`（非空字串）、`title`（非空字串）。
- 選填欄位存在時須為正確型別：`titleUrl`（string）、`blogUrl`（string）、`description`（string）、`locations`（array）、`infoBoxes`（array）。
- `travel` 物件須含 `text`（string）和 `type`（string）。

#### Hotel 結構
- 必填：`name`（非空字串）、`breakfast`（物件，含 `included`）。
- 選填欄位存在時須為正確型別：`url`（string）、`blogUrl`（string）、`checkout`（string）、`details`（array）、`infoBoxes`（array）。
- `hotel.subs` 已移除，停車場資料 SHALL 位於 `hotel.infoBoxes[type=parking]`。

#### Flights 結構（若存在）
- 須含 `title`（非空字串）和 `content.segments`（陣列）。
- 每個 segment 須含 `label`（非空字串）、`route`（非空字串），以及 `time`（字串）或 `depart` + `arrive`（皆為字串）。

#### Highlights 結構
- 須含 `title`（非空字串）和 `content`（含 `summary` string 和 `tags` array）。

#### Suggestions 結構
- `suggestions.content.cards[].priority` 值只能為 `high`、`medium` 或 `low`。

---

### R1 料理偏好
首次為某行程產生餐廳推薦前，詢問使用者料理偏好（最多 3 類，依優先排序）。第 1 家餐廳對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。同一趟行程已知偏好不重複詢問。

### R2 餐次完整性（航程感知）
每日 timeline 須包含午餐和晚餐。缺少時插入「餐廳未定」entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等）SHALL 插入午餐 timeline entry（title 為「午餐（團體行程已含）」），不附 restaurants infoBox 推薦。晚餐依到達地點推薦。航程到達日與出發日依航班時間判斷：到達日以到達時間為準（< 11:30 需午餐+晚餐、11:30~17:00 需晚餐、≥ 17:00 晚餐可選）；出發日以出發時間為準（< 11:30 不需午晚餐、11:30~17:00 需午餐、≥ 17:00 需午餐+晚餐）。無 flights 資料時每日皆須午晚餐。

**豁免：** hotel name 為「家」的在地行程，跳過該日所有餐次檢查。

### R3 餐廳推薦品質
每個 restaurants infoBox 含 1～3 家餐廳（目標補到 3 家）。每家必填 hours（營業時間）、reservation（訂位資訊）、blogUrl（繁中網誌）。營業時間須與用餐時間吻合（餐廳開始營業時間 ≤ event 時間 + 1 小時，不推薦 17:00 開的店當午餐）。餐廳 category 須與 `meta.foodPreferences` 順序對應（第 1 家對應偏好 1，以此類推）。

### R4 景點品質
titleUrl 放官網（找不到則省略欄位）。blogUrl 放繁中推薦網誌（查不到則為空字串 `""`）。infoBoxes 確認含營業時間，且與到訪時間吻合。

### R5 飯店品質
hotel 物件含 blogUrl，放繁中推薦網誌。blogUrl 查不到適合的繁中文章時為空字串 `""`。

**豁免：** hotel name 為「家」或以「（」開頭的特殊標記（如「（返台）」），跳過 blogUrl 檢查。

### R6 搜尋方式
所有 blogUrl 以 Google「{名稱} {地區} 推薦」搜尋，取第一篇繁體中文文章。優先選 pixnet、mimigo、kafu 等台灣旅遊部落格。

### R7 購物景點推薦
統一使用 `infoBox type=shopping`（不使用 souvenir type）。飯店附近超市/超商/唐吉軻德以 shopping infoBox 結構化顯示。超商（步行 5 分鐘內）含 mustBuy + blogUrl。獨立購物行程（來客夢/iias/Outlet/PARCO CITY）同樣附 shopping infoBox。景點附近步行 5~10 分鐘有超市或唐吉軻德時，在該景點 entry 加 shopping infoBox。每個 shop 含 category、name、hours、mustBuy（至少 3 項）、blogUrl。shop 不含 titleUrl。自駕行程飯店 infoBoxes 須有停車場資訊（`type: "parking"`）。

shop.category 使用標準分類（共 7 類）：超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet。

**飯店 shopping 要求：** 非「家」及非「（」開頭的飯店，hotel.infoBoxes 須包含至少一個 `type: "shopping"` 的 infoBox，且該 infoBox 內 shops 陣列至少 3 家。

#### 飯店購物 infoBox checklist（兩階段）

**階段 1：驗證既有**
- 所有 shopping infoBox 的 shop.category 是否為 7 類標準分類之一
- 每個 shop 是否含 category/name/hours/mustBuy(>=3)/blogUrl
- 是否有 souvenir type 殘留需改為 shopping

**階段 2：生成缺漏**
- 逐日檢查：hotel 物件是否有 infoBoxes 陣列？
- 若無 infoBoxes 或無 type=shopping → 新建 shopping infoBox
- 搜尋飯店名稱 + 附近超市/超商/唐吉軻德，補到 3+ shops
- shopping infoBox 放在 hotel.infoBoxes，不放在 timeline entry

### R8 早餐欄位
每日 hotel 物件須包含 `breakfast` 欄位。使用者指定飯店含早餐時：`{ "included": true, "note": "早餐說明" }`。自行解決：`{ "included": false }`。未指定：`{ "included": null }`（顯示「資料未提供」，此為 R0 null 禁用的唯一例外）。若查得到飯店最晚退房時間，以 `hotel.checkout` 記錄（如 `"11:00"`）。使用者安排的入退房時間在 timeline events 中，hotel 不重複。

### R9 AI 亮點精簡
`highlights.content.summary` 須為 50 字以內的旅程風格評語。不列舉具體景點、不使用「Day X」開頭的行程描述。以旅程整體風格、特色、適合對象等角度撰寫。`tags` 陣列保持不變。

### R10 還車加油站
自駕行程（`meta.selfDrive` 為 `true`）產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。以 `gasStation` infoBox 結構化呈現（含 name、address、hours、service、phone，選填 location）。優先推薦フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`；若附近僅有自助加油站，標註 `service: "セルフ（自助）"`。搜尋方式：Google「{還車地點} 附近 人工加油站」。

### R11 地圖導航
實體地點類 timeline event（非 travel、非「餐廳未定」、非純描述型）SHALL 含 `location` 物件，用於地圖導航。`location` 包含 `googleQuery`（Google Maps 搜尋字串）和/或 `appleQuery`（Apple Maps 搜尋字串）。

### R12 Google 評分
所有 POI（實體地點類 timeline event、餐廳、商店、加油站）SHALL 含 `googleRating` 欄位（數字，1.0-5.0）。travel event 和「餐廳未定」event 略過 R12 檢查。
