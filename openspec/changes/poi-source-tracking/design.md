## Context

行程 JSON 中的 POI（餐廳、景點、飯店、購物點、加油站）目前無法區分來源。R13 POI 真實性驗證已存在，但對所有 POI 一律給 warning。使用者希望 AI 產出的不存在 POI 直接判定為 fail，而使用者指定的 POI 僅為 warning。

現有 POI 物件結構（以餐廳為例）：
```json
{ "name": "...", "googleRating": 4.2, "reservation": {...}, ... }
```

## Goals / Non-Goals

**Goals:**
- 在每個 POI 物件新增 `source` 欄位，區分 `"user"` 與 `"ai"`
- tp-check R13 依 source 套用不同驗證等級
- 所有行程操作 skill 正確標記 source
- 現有資料遷移（全部標記為 `"ai"`）

**Non-Goals:**
- 不追蹤更細粒度的來源（如哪個使用者、哪次 Issue）
- 不改變前端渲染邏輯（source 欄位純供驗證用，不顯示在 UI）
- 不回溯判斷既有 POI 的真實來源（全部視為 AI 產生）

## Decisions

### D1: source 欄位位置 — POI 物件頂層

`source` 放在每個 POI 物件的頂層屬性，與 `name` 同級。

**替代方案**：集中管理（如 metadata section）→ 增加複雜度且難以與 POI 一對一對應，放棄。

### D2: 欄位值 — 二值 enum

`"user"` | `"ai"`，不設第三值。

- `"user"`：使用者在 tp-edit / tp-issue 中明確指定 POI 名稱
- `"ai"`：tp-create 產出、或使用者給模糊描述（如「加個午餐」）由 AI 選擇

### D3: 預設值 — "ai"

既有資料全部標記 `"ai"`。理由：所有既有行程皆由 tp-create 產生。

### D4: 標記時機 — Skill 層級

由各 skill（tp-create、tp-edit、tp-issue）在產生/修改 POI 時標記 source，而非在 tp-check 時推斷。

### D5: R13 驗證等級

| source | 驗證失敗結果 |
|--------|------------|
| `"ai"` | fail（紅燈）— AI 產出的 POI 必須存在 |
| `"user"` | warning（黃燈）— 尊重使用者指定，提醒即可 |

### D6: 適用的 POI 類型

所有 POI 類型皆需標記：
- `restaurant`（infoBoxes type: "restaurants"）
- timeline `event`（非 travel 類）
- `hotel`（name ≠ "家" 且不以「（」開頭）
- `shop`（infoBoxes type: "shopping"）
- `gasStation`（infoBoxes type: "gasStation"）

## Risks / Trade-offs

- **資料遷移量大** → 7 個行程、數百個 POI 需加 source 欄位。使用腳本批次處理降低風險。
- **source 判斷邊界** → 「Day 3 午餐換成一蘭拉麵」中「一蘭拉麵」是 user 指定，但「Day 3 加個午餐」中的餐廳是 ai 選擇。各 skill prompt 需清楚定義判斷規則。
- **欄位遺漏** → 新 skill 或手動編輯可能忘記加 source。schema test 加入 source 欄位存在性檢查作為防線。
