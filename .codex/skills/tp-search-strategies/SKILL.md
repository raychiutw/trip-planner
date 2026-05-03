---
name: tp-search-strategies
description: POI 搜尋策略內部參考 — googleRating、reservation、location、hours 的查詢方式。不直接 invoke，被 tp-create、tp-edit、tp-patch 引用。
user-invocable: false
---

# 行程資料策略參考

Event type schema（各類型物件必填欄位）見 `references/event-schema.md`。

## Search Strategies

各欄位的搜尋方式、關鍵字模板、驗證規則。Agent 搜尋時依此執行。

### 前置步驟：Google Maps 驗證（鐵律）

**Google Maps 是 POI 的 source of truth。** 所有 tp-* skills 新增或更新 POI 時，必須先通過 Google Maps 驗證。查不到 = 無效 POI，不得新增或保留。

**驗證流程：**

1. WebSearch「{POI 名稱} {地區} Google Maps」
2. 從搜尋結果確認 Google Maps 上有該 POI 的頁面（有明確地址、座標、評分）
3. 從 Google Maps 結果提取 source of truth 資料：
   - **lat/lng**（座標）— 必填，精度 4 位小數
   - **address**（地址）— 有則填
   - **google_rating**（評分）— 有則填
4. 找到 → 用 Google Maps 資料更新 POI，繼續後續搜尋
5. 找不到 → 判定為無效（無論 source 是 ai 或 user）：
   - **新增場景**（tp-create/tp-edit/tp-request）→ **不新增**，替換為 Google Maps 上可查到的真實店家
   - **既有 POI**（tp-patch/tp-rebuild）→ 執行歇業偵測清理（見 modify-steps.md §5）

**為什麼用 Google Maps 而非其他來源：** Google Maps 是最完整的全球 POI 資料庫，涵蓋座標、營業狀態、評分。Tabelog/HotPepper 僅限日本餐飲，地址 geocoding 有誤差，WebSearch 結果無法保證座標準確性。以 Google Maps 為唯一 source of truth 可確保所有 POI 資料一致且可驗證。

### googleRating

適用：hotel、restaurant、shop、event、gasStation

查詢策略見 `tp-shared/references.md`（browse-first，WebSearch fallback）。

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

1. WebSearch「{名稱} {地區} GPS coordinates」或「{名稱} Google Maps 座標」
2. 從 Google Maps 結果提取 lat/lng（source of truth）
3. 取得正式地名作為 `name`
4. `googleQuery`/`appleQuery`：「{名稱}+{地址或地區}」
5. 同步更新 `pois.lat`/`pois.lng`（PATCH /pois/:id）

驗證：name、googleQuery、appleQuery 皆為非空字串。lat/lng 須為有效數字。自駕行程可含 `mapcode`。
