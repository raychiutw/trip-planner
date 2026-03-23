# Design: days 必填欄位驗證

## 0. DB Migration（0010_days_not_null.sql）

SQLite 不支援 `ALTER COLUMN ADD NOT NULL`，需 recreate table：

```sql
-- Step 1: 先把現有 null 值補上預設（安全網，正式環境已手動修復）
UPDATE days SET date = '' WHERE date IS NULL;
UPDATE days SET day_of_week = '' WHERE day_of_week IS NULL;
UPDATE days SET label = '' WHERE label IS NULL;

-- Step 2: Recreate table with NOT NULL
CREATE TABLE days_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_num         INTEGER NOT NULL,
  date            TEXT NOT NULL DEFAULT '',
  day_of_week     TEXT NOT NULL DEFAULT '',
  label           TEXT NOT NULL DEFAULT '',
  weather_json    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_id, day_num)
);

-- Step 3: Copy data
INSERT INTO days_new SELECT * FROM days;

-- Step 4: Drop old, rename new
DROP TABLE days;
ALTER TABLE days_new RENAME TO days;

-- Step 5: Recreate index
CREATE INDEX IF NOT EXISTS idx_days_trip ON days(trip_id);
```

**注意**：SQLite foreign key 指向 `days(id)` 的子表（hotels, entries）在 DROP + RENAME 後仍有效，因為 D1 預設 `PRAGMA foreign_keys = OFF`，且 id 值不變。

## 1. API 端點修改

**檔案**：`functions/api/trips/[id]/days/[num].ts`

在 `onRequestPut` 的 body 解析後、執行 SQL 前，加入驗證：

```typescript
// Required field validation
const missing = [];
if (!body.date) missing.push('date');
if (!body.dayOfWeek) missing.push('dayOfWeek');
if (!body.label) missing.push('label');
if (missing.length > 0) {
  return json({ error: `必填欄位缺失: ${missing.join(', ')}` }, 400);
}
```

### date 格式驗證

```typescript
if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
  return json({ error: 'date 格式必須為 YYYY-MM-DD' }, 400);
}
```

### label 長度驗證（R0: ≤ 8 字）

```typescript
if (body.label.length > 8) {
  return json({ error: 'label 不得超過 8 字' }, 400);
}
```

## 2. Skill 修改

### tp-create SKILL.md

在步驟說明中明確標示 days meta 必填：

```
每天 PUT 的 request body 必須包含：
- date (YYYY-MM-DD, 必填)
- dayOfWeek (中文星期, 必填, e.g. "一"/"二"/..."日")
- label (≤8 字, 必填, 當日主題)
```

### tp-edit SKILL.md

在「覆寫整天」的注意事項加入：

```
覆寫整天（PUT）時，必須保留原始的 date、dayOfWeek、label，不得為 null。
```

### tp-rebuild SKILL.md

在品質修復項目中加入：

```
檢查並修復 days meta 缺漏：date、day_of_week、label 不得為 null。
若缺漏，根據 trip 起始日 + day_num 推算 date，再推算 dayOfWeek。
label 根據 timeline 內容摘要。
```

## 3. 測試

- Unit test：API 驗證邏輯（缺欄位回 400、格式錯回 400、正常回 200）
