## ADDED Requirements

### Requirement: R1 料理偏好詢問
`/render-trip` 為某行程產生餐廳推薦前，SHALL 先讀取 JSON `meta.foodPreferences`；若欄位存在且非空則直接採用，否則詢問使用者並將回答寫回 JSON。後續推薦的第 1 家餐廳 SHALL 對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。

#### Scenario: JSON 已有偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 為非空陣列
- **THEN** SHALL 直接採用，不詢問使用者

#### Scenario: JSON 無偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 不存在或為空陣列
- **THEN** SHALL 詢問「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得回答後 SHALL 寫回 `meta.foodPreferences`

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 某 restaurants infoBox 包含多家餐廳推薦
- **THEN** 第 1 家 SHALL 對應偏好 index 0、第 2 家對應 index 1、第 3 家對應 index 2

#### Scenario: 偏好料理不可得時
- **WHEN** 某偏好料理在行程地點附近找不到評價足夠的餐廳
- **THEN** SHALL 以行程地點附近評價最高的餐廳補位，並在 `notes` 欄位標註「當地無符合偏好之選項，改推薦{實際料理類型}」

### Requirement: R2 餐次完整性
每日 timeline SHALL 包含午餐和晚餐。若缺少，SHALL 插入「餐廳未定」timeline entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等含導遊的固定行程包）不補午餐，晚餐依到達地點推薦。返台日或深夜抵達日依時間判斷是否需要。

#### Scenario: 缺午餐補齊
- **WHEN** 某日 timeline 無午餐 entry 且非一日遊團
- **THEN** SHALL 在適當時間點插入 `{ title: "午餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 缺晚餐補齊
- **WHEN** 某日 timeline 無晚餐 entry
- **THEN** SHALL 在適當時間點插入 `{ title: "晚餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 一日遊團不補午餐
- **WHEN** 某日行程為 KKday/Klook 等一日遊團體行程
- **THEN** SHALL 不補午餐，晚餐依團體行程結束後到達地點推薦

### Requirement: R3 餐廳推薦品質
每個 `infoBoxes[type=restaurants]` 的 `restaurants` 陣列 SHALL 補到 3 家。每家餐廳 SHALL 包含 `hours`（營業時間）、`reservation`（訂位資訊）、`blogUrl`（繁中推薦網誌）。推薦餐廳的營業時間 MUST 與用餐時間吻合。選擇依據為行程當時地點附近、評價高的餐廳。餐廳的料理類別 SHALL 對齊 `meta.foodPreferences` 的優先順序排列。

#### Scenario: 餐廳補到 3 家
- **WHEN** 某 restaurants box 不足 3 家
- **THEN** SHALL 以行程當時位置附近、評價高為條件補足到 3 家，每家依料理偏好排序

#### Scenario: category 對齊偏好順序
- **WHEN** 補齊或新增餐廳至 restaurants infoBox
- **THEN** 餐廳陣列中各家的料理類別 SHALL 依序對應 `meta.foodPreferences` index 0、1、2

#### Scenario: 營業時間吻合
- **WHEN** 推薦午餐餐廳
- **THEN** 該餐廳的 `hours` MUST 涵蓋午餐時段（不得推薦 17:00 才開的店當午餐）

#### Scenario: 必填欄位完整
- **WHEN** 新增任一餐廳
- **THEN** SHALL 填寫 `hours`、`reservation`（需訂位/不需訂位/電話等）、`blogUrl`

### Requirement: R4 景點品質
景點 timeline entry 的 `titleUrl` SHALL 放官網連結（找不到官網則不放）。景點 timeline entry SHALL 新增 `blogUrl` 欄位放繁中推薦網誌。景點 `infoBoxes` SHALL 包含營業時間資訊。

#### Scenario: 景點 titleUrl 為官網
- **WHEN** 景點有官方網站
- **THEN** `titleUrl` SHALL 為該景點官方網站 URL

#### Scenario: 景點 blogUrl 為繁中網誌
- **WHEN** 景點 timeline entry 產生或補齊
- **THEN** SHALL 搜尋 Google「{景點名} {地區} 推薦」，將第一篇繁體中文文章 URL 填入 `blogUrl`

#### Scenario: 景點含營業時間
- **WHEN** 景點有營業時間限制
- **THEN** `infoBoxes` 中 SHALL 包含營業時間項目，且 MUST 確認與行程安排的到訪時間吻合

### Requirement: R5 飯店品質
Hotel 物件 SHALL 新增 `blogUrl` 欄位，放繁中推薦網誌連結。

#### Scenario: 飯店 blogUrl
- **WHEN** 行程包含飯店
- **THEN** hotel 物件 SHALL 含 `blogUrl`，值為 Google「{飯店名} 推薦」的第一篇繁體中文文章 URL

### Requirement: R6 搜尋方式
所有 blogUrl 的搜尋 SHALL 以 Google「{名稱} {地區} 推薦」為關鍵字，取第一篇繁體中文文章。優先選擇 pixnet、mimigo、kafu 等常見台灣旅遊部落格。

#### Scenario: 搜尋繁中網誌
- **WHEN** 需填寫任一 blogUrl
- **THEN** SHALL 以 Google 搜尋「{名稱} {地區} 推薦」，從結果中選取第一篇繁體中文文章 URL

### Requirement: R7 購物景點推薦
飯店附近有超市、唐吉軻德等購物點時，SHALL 以 `infoBox type=shopping` 結構化顯示（取代 hotel.subs 純文字）。獨立購物行程（來客夢/iias/Outlet/購物商圈）同樣 SHALL 附 shopping infoBox。每個購物景點 SHALL 包含 `mustBuy` 必買推薦。渲染 SHALL 復用既有 `.restaurant-choice` CSS，不新增 CSS。

#### Scenario: 飯店附近購物 infoBox
- **WHEN** 飯店附近有超市、唐吉軻德或其他購物點
- **THEN** 該飯店的 timeline entry SHALL 包含 `infoBox type=shopping`，每個 shop 含 `category`、`name`、`hours`、`mustBuy[]`、`blogUrl`

#### Scenario: 獨立購物行程 infoBox
- **WHEN** timeline 中有購物類景點（來客夢、iias、Outlet、購物商圈等）
- **THEN** 該 timeline entry SHALL 包含 `infoBox type=shopping`，結構同飯店購物 infoBox

#### Scenario: mustBuy 必買推薦
- **WHEN** 新增任一 shopping infoBox 的 shop
- **THEN** SHALL 填寫 `mustBuy` 陣列（至少 3 項推薦商品/品類）

#### Scenario: renderShop 復用既有 CSS
- **WHEN** app.js 渲染 shopping infoBox
- **THEN** SHALL 使用 `renderShop()` 函式，復用 `.restaurant-choice` CSS class，不新增任何 CSS
