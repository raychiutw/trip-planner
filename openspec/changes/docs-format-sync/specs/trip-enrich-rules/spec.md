## MODIFIED Requirements

### Requirement: R7 購物景點推薦
飯店附近有超市、唐吉軻德、超商等購物點時，SHALL 以 `infoBox type=shopping` 結構化顯示。飯店 subs 中的購物文字 SHALL 搬到 shopping infoBox，subs 僅保留停車場等非購物資訊。獨立購物行程（來客夢/iias/Outlet/PARCO CITY/購物商圈）同樣 SHALL 附 shopping infoBox。景點附近步行 5~10 分鐘內有超市或唐吉軻德時，SHALL 在該景點 timeline entry 加 shopping infoBox。每個購物景點 SHALL 包含 `mustBuy` 必買推薦。渲染 SHALL 復用既有 `.restaurant-choice` CSS，不新增 CSS。所有 shop item 不含 `titleUrl`。不再使用 `souvenir` infoBox type，統一為 `shopping`。

**shop.category SHALL 使用以下 7 類標準分類（timeline 景點購物與飯店購物共用）：**

| category | 說明 |
|----------|------|
| 超市 | AEON、UNION、MaxValu、りうぼう 等連鎖超市 |
| 超商 | Lawson、FamilyMart、7-11 等便利商店 |
| 唐吉軻德 | ドン・キホーテ / MEGA ドン・キホーテ |
| 藥妝 | 松本清、ウエルシア 等藥妝店 |
| 伴手禮 | 御菓子御殿、鹽屋、わしたショップ 等伴手禮專賣 |
| 購物中心 | PARCO CITY、來客夢、graniph 等大型商場內店鋪 |
| Outlet | ASHIBINAA 等 Outlet mall 品牌店 |

#### Scenario: 飯店附近購物 infoBox
- **WHEN** 飯店附近有超市、唐吉軻德、超商或其他購物點
- **THEN** 該飯店的 `hotel.infoBoxes` SHALL 包含 `infoBox type=shopping`，每個 shop 含 `category`（7 類之一）、`name`、`hours`、`mustBuy[]`（至少 3 項）、`blogUrl`

#### Scenario: 飯店附近超商
- **WHEN** 飯店步行 5 分鐘內有便利商店（7-11、FamilyMart、Lawson 等）
- **THEN** SHALL 以 shop entry 記錄，category 為「超商」，含 `mustBuy`（當地限定商品推薦）和 `blogUrl`

#### Scenario: 飯店 subs 購物搬遷
- **WHEN** 飯店 subs 中包含 `type: "shopping"` 的購物項
- **THEN** SHALL 將購物資訊轉換為 shopping infoBox 格式搬到 `hotel.infoBoxes`，subs 僅保留 parking 等非購物項

#### Scenario: 自駕飯店停車場
- **WHEN** 行程為自駕且飯店有停車場
- **THEN** 飯店 subs SHALL 包含停車場資訊（type: "parking"、title、price、location）

#### Scenario: 獨立購物行程 infoBox
- **WHEN** timeline 中有購物類景點（來客夢、iias、Outlet、PARCO CITY、購物商圈等）
- **THEN** 該 timeline entry SHALL 包含 `infoBox type=shopping`，每個 shop 含 `category`（7 類之一）、`name`、`hours`、`mustBuy[]`（至少 3 項）、`blogUrl`

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

#### Scenario: renderShop 復用既有 CSS
- **WHEN** app.js 渲染 shopping infoBox
- **THEN** SHALL 使用 `renderShop()` 函式，復用 `.restaurant-choice` CSS class，不新增任何 CSS

#### Scenario: category 標準分類驗證
- **WHEN** 任一 shop entry 的 category 值
- **THEN** SHALL 為 7 類標準分類之一：超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet
