## ADDED Requirements

### Requirement: search-strategies.md 共用搜尋策略檔案

`.claude/commands/search-strategies.md` SHALL 定義兩部分內容：
1. **Event Type Schema**：各類型 event / hotel / restaurant / shop 的必填欄位定義
2. **Search Strategies**：各欄位的搜尋方式、關鍵字模板、驗證規則

供 tp-create、tp-rebuild、tp-patch 引用。

#### Scenario: 檔案位置
- **WHEN** 任何 skill 需要搜尋行程資料欄位或確認骨架必填欄位
- **THEN** SHALL 引用 `.claude/commands/search-strategies.md`

### Requirement: Event Type Schema 定義

search-strategies.md SHALL 定義每種 event 類型的必填欄位清單，供 tp-create Phase 1 骨架生成時參照，確保不遺漏欄位。

#### Scenario: 景點/活動 Event（Type A，無 travel 屬性）
- **WHEN** 生成一個景點或活動 event（無 travel 屬性）
- **THEN** 必填欄位 SHALL 為：time, title, description, blogUrl, googleRating, locations[]
- **AND** 選填欄位為：titleUrl, infoBoxes

#### Scenario: 交通 Event（Type B，有 travel 屬性）
- **WHEN** 生成一個交通 event（有 travel 屬性）
- **THEN** 必填欄位 SHALL 為：time, title, travel { text, type, minutes }
- **AND** SHALL 不包含 blogUrl, googleRating, locations

#### Scenario: 餐廳 Event（Type C，有 restaurants infoBox）
- **WHEN** 生成一個含餐廳推薦的 event
- **THEN** event 必填欄位 SHALL 為：time, title, blogUrl, googleRating, locations[], infoBoxes
- **AND** 每個 restaurant 必填欄位 SHALL 為：category, name, description, price, hours, reservation, blogUrl, googleRating, location { name, googleQuery, appleQuery }

#### Scenario: 航班 Event（Type D，起飛/降落）
- **WHEN** 生成一個航班相關 event
- **THEN** 必填欄位 SHALL 為：time, title, blogUrl(""), googleRating, locations[]

#### Scenario: Hotel 必填欄位
- **WHEN** 生成 hotel 物件
- **THEN** 必填欄位 SHALL 為：name, url, blogUrl, checkout, details[], breakfast { included, note }, infoBoxes
- **AND** shopping infoBox 內每個 shop 必填：category, name, hours, mustBuy(>=3), blogUrl, googleRating, location

#### Scenario: tp-create Phase 1 骨架完整性掃描
- **WHEN** tp-create Phase 1 骨架生成完成
- **THEN** SHALL 遍歷所有 event，依 Event Type Schema 檢查每個 event 的必填欄位是否完整
- **AND** 發現缺漏 SHALL 自動補上（blogUrl → ""、googleRating → 省略或預設、locations → 空陣列）
- **AND** 不需手動撰寫 fix script

### Requirement: googleRating 搜尋策略

search-strategies.md SHALL 定義 googleRating 的搜尋方式。

#### Scenario: googleRating 搜尋流程
- **WHEN** 需要搜尋某地點的 googleRating
- **THEN** SHALL 依序嘗試：
  1. WebSearch「{名稱} Google Maps 評分」
  2. WebSearch「{名稱} Google rating」
  3. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
- **AND** 結果 SHALL 為 1.0–5.0 的數字
- **AND** 找不到時 SHALL 標記待確認，不填預設值

#### Scenario: googleRating 適用 target
- **WHEN** 查詢 googleRating 適用對象
- **THEN** SHALL 列出：hotel、restaurant、shop、event、gasStation

### Requirement: blogUrl 搜尋策略

search-strategies.md SHALL 定義 blogUrl 的搜尋方式。

#### Scenario: blogUrl 搜尋流程
- **WHEN** 需要搜尋某地點的 blogUrl
- **THEN** SHALL 依序嘗試：
  1. WebSearch「{名稱} {地區} 推薦」
  2. 優先繁中部落格：pixnet、bobbyfun、boo2k、mimigo
  3. 找不到繁中文章 → 空字串 `""`
- **AND** 結果 SHALL 為合法 URL 或空字串

#### Scenario: blogUrl 適用 target
- **WHEN** 查詢 blogUrl 適用對象
- **THEN** SHALL 列出：hotel、restaurant、shop、event

### Requirement: reservation 搜尋策略

search-strategies.md SHALL 定義 reservation 結構化物件的搜尋方式。

#### Scenario: reservation 搜尋流程
- **WHEN** 需要搜尋某餐廳的 reservation 資訊
- **THEN** SHALL 依序嘗試：
  1. WebSearch「{餐廳名稱} 予約 tabelog」
  2. WebSearch「{餐廳名稱} hotpepper 予約」
  3. WebSearch「{餐廳名稱} TableCheck」
  4. 判斷結果：
     - 有預約頁面 → `available: "yes"`, `method: "website"`, `url: ...`
     - 有電話但無網頁預約 → `available: "yes"`, `method: "phone"`, `phone: ...`
     - 明確標示「予約不可」→ `available: "no"`
     - 找不到 → `available: "unknown"`
  5. 搜尋「{餐廳名稱} 予約 おすすめ」判斷 `recommended`

#### Scenario: reservation 適用 target
- **WHEN** 查詢 reservation 適用對象
- **THEN** SHALL 僅列出：restaurant

### Requirement: location 搜尋策略

search-strategies.md SHALL 定義 location 物件的搜尋方式。

#### Scenario: location 搜尋流程
- **WHEN** 需要搜尋某地點的 location 資訊
- **THEN** SHALL 搜尋 Google Maps 取得地名、googleQuery、appleQuery
- **AND** 結果 SHALL 為 `{ name, googleQuery, appleQuery }` 物件

#### Scenario: location 適用 target
- **WHEN** 查詢 location 適用對象
- **THEN** SHALL 列出：restaurant（location 物件）、event（locations 陣列）
