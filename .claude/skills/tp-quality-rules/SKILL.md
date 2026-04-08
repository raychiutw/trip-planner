---
name: tp-quality-rules
description: R0-R18 品質規則定義庫 — 被 tp-check、tp-create、tp-edit、tp-rebuild 引用，不直接 invoke。
user-invocable: false
---

# 行程品質規則

產生或修改行程資料時（透過 D1 API），必須遵守以下所有品質規則。

### R0 JSON 結構與值約束

#### 值約束
- 行程 JSON 中**禁止使用 `null`**（唯一例外：`hotel.breakfast.included` 允許 `null` 表示「資料未提供」）。找不到的字串欄位用空字串 `""`，找不到的數字欄位省略該欄位，找不到的物件/陣列欄位省略該欄位。`typeof null === "object"` 會導致 schema 測試失敗。
- 每日 `label` **不超過 8 字**。超過時用更簡潔的寫法，例如「甘川洞・松島」而非「甘川洞・松島・南浦」。

#### URL 與格式安全性
- 所有 URL 欄位（googleQuery、appleQuery、reservationUrl）的值必須以 `http://`、`https://` 或 `tel:` 開頭，否則視為不安全。
- `googleQuery` 必須為 Google Maps URL，格式為 `https://www.google.com/maps/search/<percent-encoded-query>`。
- `appleQuery` 必須為 Apple Maps URL，格式為 `https://maps.apple.com/?q=<percent-encoded-query>`。
- `naverQuery` 必須為 Naver Maps URL（以 `https://map.naver.com/` 開頭），優先使用精確 place URL `https://map.naver.com/v5/entry/place/{placeId}`，查不到時 fallback 為 `https://map.naver.com/v5/search/{韓文關鍵字}`。
- `mapcode` 格式為 `XX XXX XXX*XX`（如 `33 530 406*00`），正則：`/^\d{2,4}\s\d{3}\s\d{3}\*\d{2}$/`。僅 `meta.countries` 含 `"JP"` 且 `meta.selfDrive === true` 時必填。

#### 根層級必填欄位
- 必填：`meta`（含 `title` 非空字串、`selfDrive` boolean、`countries` 非空陣列，值為 ISO 3166-1 alpha-2 國碼如 `["JP"]`）、`days`（非空陣列）、`autoScrollDates`（非空陣列）、`footer`（含 `title`、`dates`）、`suggestions`、`checklist`。
- 選填：`flights`、`emergency`（存在時驗證結構）。
- `meta` 不得包含已移除欄位（`themeColor`）。

#### 每日結構
- 每日必填：`id`、`date`（非空字串）、`label`、`content.timeline`（陣列）。
- 每日選填：`weather`（物件，含 `label` 字串、`locations` 陣列）。`weather.locations[].lat` 和 `lon` 須為 number 型別。
- `days[i].id` 必須等於 `i + 1`（從 1 開始的連續整數）。
- `autoScrollDates[]` 須為 ISO 格式 `YYYY-MM-DD`。

#### Timeline event 結構
- 每個 event 必填：`time`（非空字串）、`title`（非空字串）。
- 選填欄位存在時須為正確型別：`description`（string）、`locations`（array）、`infoBoxes`（array）。
- `travel` 物件須含 `desc`（string）和 `type`（string）。選填 `min`（number，分鐘）。

#### Hotel 結構
- 必填：`name`（非空字串）、`breakfast`（物件，含 `included`）。
- 選填欄位存在時須為正確型別：`checkout`（string）、`details`（array）、`infoBoxes`（array）。
- `hotel.subs` 已移除，停車場資料 SHALL 位於 `hotel.infoBoxes[type=parking]`。
- 行程最後一天（`days` 陣列最後一個元素）不得包含 `hotel` 物件（返家日無需住宿）。

#### Flights 結構（若存在）
- 須含 `title`（非空字串）和 `content.segments`（陣列）。
- 每個 segment 須含 `label`（非空字串）、`route`（非空字串），以及 `time`（字串）或 `depart` + `arrive`（皆為字串）。
- `content.airline` 為必填物件，含 `name`（非空字串）和 `note`（字串）。

#### Suggestions 結構
- `suggestions.content.cards[].priority` 值只能為 `high`、`medium` 或 `low`。

---

### R1 料理偏好
首次為某行程產生餐廳推薦前，詢問使用者料理偏好（最多 3 類，依優先排序）。第 1 家餐廳對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。同一趟行程已知偏好不重複詢問。

### R2 餐次完整性（航程感知）
每日 timeline 須包含午餐和晚餐。缺少時插入「餐廳未定」entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等）SHALL 插入午餐 timeline entry（title 為「午餐（團體行程已含）」），不附 restaurants infoBox 推薦。晚餐依到達地點推薦。航程到達日與出發日依航班時間判斷：到達日以到達時間為準（< 11:30 需午餐+晚餐、11:30~17:00 需晚餐、≥ 17:00 晚餐可選）；出發日以出發時間為準（< 11:30 不需午晚餐、11:30~17:00 需午餐、≥ 17:00 需午餐+晚餐）。無 flights 資料時每日皆須午晚餐。

**豁免：** hotel name 為「家」的在地行程，跳過該日所有餐次檢查。

### R3 餐廳推薦品質
每個 restaurants infoBox 含 1～3 家餐廳（目標補到 3 家）。每家必填 hours（營業時間）、reservation（訂位資訊）。營業時間須與用餐時間吻合（餐廳開始營業時間 ≤ event 時間 + 1 小時，不推薦 17:00 開的店當午餐）。餐廳 category 須與 `meta.foodPreferences` 順序對應（第 1 家對應偏好 1，以此類推）。同一行程內不得重複推薦相同品牌/連鎖店的不同分店（如「琉球の牛 那覇店」與「琉球の牛 恩納店」視為重複）；使用者明確指定的餐廳（`source: "user"`）優先保留，AI 推薦的重複店家須替換為其他選項。

### R4 景點品質
infoBoxes 確認含營業時間，且與到訪時間吻合。

### R7 購物景點推薦
統一使用 `infoBox type=shopping`（不使用 souvenir type）。飯店附近超市/超商/唐吉軻德以 shopping infoBox 結構化顯示。超商（步行 5 分鐘內）含 mustBuy。獨立購物行程（來客夢/iias/Outlet/PARCO CITY）同樣附 shopping infoBox。景點附近步行 5~10 分鐘有超市或唐吉軻德時，在該景點 entry 加 shopping infoBox。每個 shop 含 category、name、hours、mustBuy（至少 3 項）。自駕行程飯店 infoBoxes 須有停車場資訊（`type: "parking"`）。

shop.category 使用標準分類（共 7 類）：超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet。

**飯店 shopping 要求：** 非「家」及非「（」開頭的飯店，hotel.infoBoxes 須包含至少一個 `type: "shopping"` 的 infoBox，且該 infoBox 內 shops 陣列至少 3 家。

#### 飯店購物 infoBox checklist（兩階段）

**階段 1：驗證既有**
- 所有 shopping infoBox 的 shop.category 是否為 7 類標準分類之一
- 每個 shop 是否含 category/name/hours/mustBuy(>=3)
- 是否有 souvenir type 殘留需改為 shopping

**階段 2：生成缺漏**
- 逐日檢查：hotel 物件是否有 infoBoxes 陣列？
- 若無 infoBoxes 或無 type=shopping → 新建 shopping infoBox
- 搜尋飯店名稱 + 附近超市/超商/唐吉軻德，補到 3+ shops
- shopping infoBox 放在 hotel.infoBoxes，不放在 timeline entry

### R8 早餐欄位
每日 hotel 物件須包含 `breakfast` 欄位。使用者指定飯店含早餐時：`{ "included": true, "note": "早餐說明" }`。自行解決：`{ "included": false }`。未指定：`{ "included": null }`（顯示「資料未提供」，此為 R0 null 禁用的唯一例外）。若查得到飯店最晚退房時間，以 `hotel.checkout` 記錄（如 `"11:00"`）。使用者安排的入退房時間在 timeline events 中，hotel 不重複。

### R10 還車加油站
自駕行程（`meta.selfDrive` 為 `true`）產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。以 `gasStation` infoBox 結構化呈現（含 name、address、hours、service、phone，選填 location）。優先推薦フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`；若附近僅有自助加油站，標註 `service: "セルフ（自助）"`。搜尋方式：Google「{還車地點} 附近 人工加油站」。

### R11 地圖導航
實體地點類 timeline event（非 travel、非「餐廳未定」、非純描述型）SHALL 含 `location` 物件，用於地圖導航。`location` 包含 `googleQuery`（Google Maps 搜尋字串）和/或 `appleQuery`（Apple Maps 搜尋字串）。`location.name` 為必填非空字串，使用該地點的原文名稱（日文店名、韓文店名等）。

### R12 Google 評分
所有 POI（實體地點類 timeline event、餐廳、商店、加油站）SHALL 含 `googleRating` 欄位（數字，1.0-5.0）。travel event 和「餐廳未定」event 略過 R12 檢查。

### R13 POI 來源標記
所有非豁免 POI SHALL 含 `source` 欄位（值為 `"user"` 或 `"ai"`），與 `name` 同級。POI 類型包含：timeline event（非 travel）、restaurant、hotel（name 非「家」且不以「（」開頭）、shop、gasStation。

- `"user"`：使用者明確指定名稱的 POI
- `"ai"`：AI 自行推薦或使用者僅給模糊描述（如「找一家拉麵店」）的 POI

#### 驗證等級（依 source 區分）
- `source: "ai"` 且缺少 `googleRating` → **fail**（🔴）
- `source: "user"` 且缺少 `googleRating` → **warning**（🟡）

此規則為離線檢查（不做即時搜尋），僅檢查缺少 `googleRating` 的非豁免 POI。

### R15 必填 note 欄位
所有 POI 實體（timeline event、restaurant、shop、hotel、parking infoBox）SHALL 含 `note` 欄位（字串）。有備註時填入內容，無備註時為空字串 `""`。hotel infoBox 內的 shop 和 parking 同樣適用。

### R14 國家感知規則
- `meta.countries` 含 `"KR"` 時，所有 POI 的 location 必填 `naverQuery`（Naver Maps URL）。
- `naverQuery` 優先填精確 place URL：`https://map.naver.com/v5/entry/place/{placeId}`，查不到時 fallback 為 `https://map.naver.com/v5/search/{韓文關鍵字}`。
- 非韓國行程不需要 `naverQuery` 欄位。

### R16 飯店 POI 建議填 maps + address
type 為 `hotel` 的 pois 建議有 `maps`（導航用）和 `address`（地址）。缺少 → **warning**（🟡）。
（google_rating 已由 R12/R13 涵蓋，不重複檢查。）

### R17 POI 必填導航資訊
所有 POI 必須至少有一種導航方式：`maps`（Google Maps URL 或搜尋文字）或 `lat` + `lng`。兩者都缺 → **fail**（🔴）。

### R18 飯店 POI 建議填 phone
type 為 `hotel` 的 pois 建議有 `phone`（電話）。缺少 → **warning**（🟡）。
