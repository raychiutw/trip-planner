---
name: tp-search-strategies
description: Use when searching for POI data fields (googleRating, reservation, location, naverQuery) across trip itinerary files, or generating trip skeleton with event type schema.
user-invocable: false
---

# 行程資料策略參考

Event type schema（各類型物件必填欄位）見 `references/event-schema.md`。

## Search Strategies

各欄位的搜尋方式、關鍵字模板、驗證規則。Agent 搜尋時依此執行。

### 前置步驟：POI 存在性驗證（R13）

**所有搜尋流程開始前**，須先確認 POI 存在：

1. WebSearch「{名稱} Google Maps」或「{名稱} {地區}」
2. 確認搜尋結果中有該 POI 的 Google Maps 頁面、食記、或官方網站
3. 找到 → 繼續搜尋；找不到 → 回報「POI 不存在：{名稱}」，不繼續搜尋
4. AI 產生的 POI 不存在 → 替換為真實店家；使用者提供的 → 保留 + warning

### googleRating

適用：hotel、restaurant、shop、event、gasStation

1. WebSearch「{名稱} Google Maps 評分」
2. WebSearch「{名稱} Google rating」
3. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
4. 必須是 number 1.0–5.0，找不到時不填預設值

### reservation

適用：restaurant

1. WebSearch「{餐廳名稱} 予約 tabelog」
2. WebSearch「{餐廳名稱} hotpepper 予約」
3. WebSearch「{餐廳名稱} TableCheck」
4. WebSearch「{餐廳名稱} 予約 公式サイト」
5. 判斷：有預約頁面 → `available: "yes"` + method/url；電話 → `method: "phone"`；予約不可 → `available: "no"`；找不到 → `available: "unknown"`
6. 搜尋「{名稱} 人気 予約」判斷 `recommended: true/false`

驗證：`available` 三選一、`method` 搭配 url 或 phone、`recommended` boolean

### location

適用：restaurant（location 物件）、event（locations 陣列）

1. WebSearch「{名稱} Google Maps」
2. 取得正式地名作為 `name`
3. `googleQuery`/`appleQuery`：「{名稱}+{地址或地區}」

驗證：name、googleQuery、appleQuery 皆為非空字串。自駕行程可含 `mapcode`。
