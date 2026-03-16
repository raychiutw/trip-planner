---
name: tp-search-strategies
description: Use when searching for POI data fields (googleRating, reservation, location, naverQuery) across trip itinerary files, or generating trip skeleton with event type schema.
user-invocable: false
---

# 行程資料策略參考

本文件供 tp-create、tp-rebuild、tp-patch 引用，分為兩部分：
1. **Event Type Schema**：各類型物件的必填欄位定義
2. **Search Strategies**：各欄位的搜尋方式與驗證規則

---

## Part 1: Event Type Schema

tp-create Phase 1 骨架生成時，依據以下 schema 判斷每個物件的必填欄位。Phase 1 結尾須遍歷所有物件做骨架完整性掃描，缺漏自動補上。

### Type A: 景點/活動 Event（無 travel 屬性）

| 欄位 | 必填 | 說明 |
|------|------|------|
| time | ✅ | 時間字串，如 `"10:00"` |
| title | ✅ | 景點名稱 |
| description | ✅ | 景點說明 |
| googleRating | ✅ | Google 評分（Phase 1 可省略，Phase 2 搜尋填入） |
| locations | ✅ | 地圖位置陣列 `[{ name, googleQuery, appleQuery }]` |
| infoBoxes | 選填 | 附加資訊區塊 |

### Type B: 交通 Event（有 travel 屬性）

| 欄位 | 必填 | 說明 |
|------|------|------|
| time | ✅ | 出發時間 |
| title | ✅ | 交通描述 |
| travel | ✅ | `{ text, type, minutes }`，type 為 car/bus/train/walk/monorail |

**禁填**：googleRating、locations — 有 travel 屬性的 event 不可包含這些欄位。

### Type C: 餐廳 Event（含 restaurants infoBox）

| 欄位 | 必填 | 說明 |
|------|------|------|
| time | ✅ | 用餐時間 |
| title | ✅ | 如「午餐」「晚餐」 |
| googleRating | ✅ | 設預設值或 Phase 2 搜尋 |
| locations | ✅ | 至少一個用餐區域的位置 |
| infoBoxes | ✅ | 至少一個 `type: "restaurants"` 的 infoBox |

**每個 restaurant 子物件必填：**

| 欄位 | 必填 | 說明 |
|------|------|------|
| category | ✅ | 料理分類，對應 foodPreferences |
| name | ✅ | 餐廳名稱 |
| description | ✅ | 簡述 |
| price | ✅ | 價位描述 |
| hours | ✅ | 營業時間 |
| reservation | ✅ | 預約資訊物件 |
| googleRating | ✅ | Phase 2 搜尋填入 |
| location | ✅ | `{ name, googleQuery, appleQuery }` |

### Type D: 航班 Event（起飛/降落）

| 欄位 | 必填 | 說明 |
|------|------|------|
| time | ✅ | 起飛/降落時間 |
| title | ✅ | 如「MM922 台北出發」 |
| googleRating | ✅ | 可設 4.0（機場評分） |
| locations | ✅ | 機場位置 |

### Hotel 必填欄位

| 欄位 | 必填 | 說明 |
|------|------|------|
| name | ✅ | 飯店名稱 |
| url | ✅ | 官方或訂房網站（可為 `""`） |
| googleRating | ✅ | Phase 2 搜尋填入 |
| checkout | ✅ | 退房時間（查不到設 `""`） |
| details | ✅ | 飯店詳情陣列 |
| breakfast | ✅ | `{ included: true/false/null, note: "" }` |
| infoBoxes | ✅ | 至少一個 shopping infoBox |

**Hotel 內 shop 子物件必填：**

| 欄位 | 必填 | 說明 |
|------|------|------|
| category | ✅ | 商店分類 |
| name | ✅ | 商店名稱 |
| hours | ✅ | 營業時間 |
| mustBuy | ✅ | 必買清單（≥ 3 項） |
| googleRating | ✅ | Phase 2 搜尋填入 |
| location | ✅ | `{ name, googleQuery, appleQuery }` |

### 骨架完整性掃描（Phase 1 結尾）

Phase 1 骨架生成完成後，須遍歷所有物件檢查：

1. **每個無 travel 的 event**：必須有 locations（可為空陣列）
2. **每個有 restaurants infoBox 的 event**：每個 restaurant 必須有所有必填欄位
3. **每個 hotel**（name ≠ "家"）：必須有 checkout、breakfast、shopping infoBox（≥ 3 shops）
4. **每個 shop**：必須有 category、name、hours、mustBuy（≥ 3）

發現缺漏時自動補上預設值，不需手動撰寫 fix script。

---

## Part 2: Search Strategies

各欄位的搜尋方式、關鍵字模板、驗證規則。Agent 搜尋時依此執行。

### 前置步驟：POI 存在性驗證（R13）

**所有搜尋流程開始前**，須先確認 POI 存在：

1. WebSearch「{名稱} Google Maps」或「{名稱} {地區}」
2. 確認搜尋結果中有該 POI 的 Google Maps 頁面、食記、或官方網站
3. **判斷結果**：
   - 找到 POI → 繼續搜尋該 POI 的其他欄位
   - 找不到 POI → 回報「POI 不存在：{名稱}」，**不繼續搜尋**該 POI 的其他欄位（googleRating、reservation 等）
4. **來源區分處理**（由呼叫端 skill 決定）：
   - AI 產生的 POI 不存在 → 替換為真實店家
   - 使用者提供的 POI 不存在 → 保留 + warning

### googleRating

**適用 target**：hotel、restaurant、shop、event、gasStation

**搜尋流程**：
1. WebSearch「{名稱} Google Maps 評分」
2. WebSearch「{名稱} Google rating」
3. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
4. 多來源取最可信值

**驗證規則**：
- 必須是 number，範圍 1.0–5.0
- 找不到時標記待確認，不填預設值

### reservation

**適用 target**：restaurant

**搜尋流程**：
1. WebSearch「{餐廳名稱} 予約 tabelog」
2. WebSearch「{餐廳名稱} hotpepper 予約」
3. WebSearch「{餐廳名稱} TableCheck」
4. WebSearch「{餐廳名稱} 予約 公式サイト」
5. 判斷結果：
   - 有預約頁面 → `available: "yes"`, `method: "website"`, `url: 預約連結`
   - 有電話但無網頁預約 → `available: "yes"`, `method: "phone"`, `phone: 電話號碼`
   - 明確標示「予約不可」或「並び順」→ `available: "no"`
   - 找不到資訊 → `available: "unknown"`
6. 搜尋「{餐廳名稱} 人気 予約 おすすめ」判斷 `recommended`
   - 熱門店家 / 排隊名店 / 評論建議預約 → `recommended: true`
   - 一般店家 / 隨到隨吃 → `recommended: false`

**輸出結構**：
```json
{
  "available": "yes" | "no" | "unknown",
  "method": "website" | "phone",
  "url": "https://...",
  "phone": "098-xxx-xxxx",
  "recommended": true | false
}
```

**驗證規則**：
- `available` 必須是 `"yes"` / `"no"` / `"unknown"` 三者之一
- `available = "yes"` 時 `method` 必須是 `"website"` 或 `"phone"`
- `method = "website"` 時 `url` 必須是合法 URL
- `method = "phone"` 時 `phone` 必須是非空字串
- `recommended` 必須是 boolean
- `available = "no"` 或 `"unknown"` 時，method / url / phone 不需要

### location

**適用 target**：restaurant（location 物件）、event（locations 陣列）

**搜尋流程**：
1. WebSearch「{名稱} Google Maps」
2. 取得正式地名作為 `name`
3. `googleQuery`：「{名稱}+{地址或地區}」（Google Maps 搜尋用）
4. `appleQuery`：「{名稱}+{地址或地區}」（Apple Maps 搜尋用）

**輸出結構**：
```json
{
  "name": "店名或地標名",
  "googleQuery": "店名+地址",
  "appleQuery": "店名+地址"
}
```

**驗證規則**：
- name、googleQuery、appleQuery 皆為非空字串
- 自駕行程的 event location 可額外包含 `mapcode`
