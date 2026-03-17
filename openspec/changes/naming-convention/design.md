## Context

D1 遷移後，DB 用 snake_case、前端 render 用 camelCase，中間的轉換散落在 mapApiDay/mapApiMeta 裡。API 的 trip 列表回傳 `id` 但前端期待 `tripId`，導致到處寫 `t.id || t.tripId`。

## Goals / Non-Goals

**Goals:**
- 建立 mapRow 統一轉換層（一個檔案集中管理所有 rename + JSON parse）
- API 統一回傳 `tripId`（不再用 `id`）
- 模組級可變狀態改為 camelCase（TRIP → trip）
- 建立命名規範自動驗證 skill + test
- 整合 pre-commit hook

**Non-Goals:**
- 不改 DB schema（snake_case 保持不變）
- 不改 CSS/HTML 命名（已經 100% 一致）
- 不改 API handler 內部變數命名

## Decisions

### 1. mapRow 設計

```javascript
// js/map-row.js
var FIELD_MAP = {
  // rename
  body: 'description',
  rating: 'googleRating',
  must_buy: 'mustBuy',
  reservation_url: 'reservationUrl',
  day_of_week: 'dayOfWeek',
  self_drive: 'selfDrive',
  og_description: 'ogDescription',
  day_num: 'dayNum',
  sort_order: 'sortOrder',
  parent_type: 'parentType',
  parent_id: 'parentId',
  entry_id: 'entryId',
  trip_id: 'tripId',
  doc_type: 'docType',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  submitted_by: 'submittedBy',
  changed_by: 'changedBy',
  table_name: 'tableName',
  record_id: 'recordId',
  diff_json: 'diffJson',
  request_id: 'requestId',
  food_prefs: 'foodPrefs',
};

var JSON_FIELDS = ['weather_json', 'parking_json', 'footer_json', 'location_json', 'breakfast'];

function mapRow(row) {
  var result = {};
  for (var key in row) {
    var val = row[key];
    // JSON parse
    if (JSON_FIELDS.indexOf(key) >= 0 && typeof val === 'string') {
      try { val = JSON.parse(val); } catch(e) {}
    }
    // strip _json suffix after parsing
    var outKey = key.replace(/_json$/, '');
    // rename
    if (FIELD_MAP[outKey]) outKey = FIELD_MAP[outKey];
    result[outKey] = val;
  }
  return result;
}
```

### 2. API tripId 統一

`functions/api/trips.ts` 的 SELECT 改為：
```sql
SELECT id AS tripId, name, owner, title, ...
```

所有回傳 trip 資料的 endpoint 統一用 `tripId` 欄位名。

### 3. 命名驗證 test

`tests/unit/naming-convention.test.js` 自動掃描：
- JS 檔案中不得出現 UPPER_CASE 的可變賦值（`TRIP =`、`CURRENT_TRIP_ID =`）
- JS 中不得出現 `t.id || t.tripId` 模式
- CSS class 必須 kebab-case
- HTML id 必須 camelCase（靜態）或 kebab-case（動態）

### 4. Skill 設計

`/tp-naming` — commit 前驗證：
1. 跑 `npm test`（含 naming-convention.test.js）
2. 掃描 staged files 的命名規範
3. 回報綠燈/紅燈
4. 紅燈則列出違規並自動修正

## Risks / Trade-offs

- **大量重命名風險**：TRIP → trip 影響 app.js 全檔（~50 處引用）→ 用 replace_all 一次改完，跑測試確認
- **API 改 tripId 影響前端**：所有 fetch API 的地方要改 → 但統一後反而更簡單
