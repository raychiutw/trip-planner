# Plan: POI 正規化 + 欄位統一 + Markdown 渲染

**Status: APPROVED** (autoplan 三審通過 2026-03-28)

## 動機

1. **資料重複**：42 間飯店只有 12 個不重複（71% 重複），162 個購物點只有 98 不重複（39%）
2. **欄位命名混亂**：同一語意有 `body`/`details`/`description`/`note` 四種名字
3. **無 source of truth**：同一家店在不同行程各自維護，營業時間、評分、描述不同步
4. **文字欄位無法換行**：`\n` 被 HTML 忽略

## 核心設計

### POI = git repo 類比

```
pois（upstream master）
  │  官方資料：名稱、地址、電話、評分、營業時間
  │
  ├── trip A 的引用（fork）→ 可覆寫 note、description
  ├── trip B 的引用（fork）→ 可覆寫 note、description
  │
  sync 機制：
  - master → fork：master 更新時，fork 中未覆寫的欄位自動跟進
  - fork → master：skill 更新 google_rating/hours 時，回寫 master
  - 行程專屬欄位（note、trip-specific description）不回寫 master
```

---

## 新 DB Schema

### `pois`（source of truth，跨行程共用）

```sql
CREATE TABLE pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('hotel','restaurant','shopping','parking','attraction','transport','other')),
  name          TEXT NOT NULL,
  description   TEXT,           -- 官方/通用描述
  address       TEXT,           -- 〒900-0025 沖縄県那覇市壺川3-3-19
  phone         TEXT,           -- 098-855-7111
  email         TEXT,           -- H8725-RE@accor.com
  website       TEXT,           -- 官網 URL
  hours         TEXT,           -- 營業時間
  google_rating REAL,           -- Google 評分
  category      TEXT,           -- 拉麵/燒肉/超市/藥妝/...
  maps          TEXT,           -- Google Maps 搜尋名
  mapcode       TEXT,           -- Map Code
  location_json TEXT,           -- {"lat":26.2019,"lng":127.6726}
  meta_json     TEXT,           -- 類型專屬欄位（見下方）
  country       TEXT DEFAULT 'JP',
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pois_type ON pois(type);
CREATE INDEX idx_pois_name ON pois(name);
CREATE INDEX idx_pois_country ON pois(country);
```

**`meta_json` 按 type 存不同內容：**

| type | meta_json 結構 |
|------|---------------|
| hotel | `{ checkout, breakfast: {included, note}, parking: {price, note, maps, mapcode}, booking_source }` |
| restaurant | `{ price, reservation, reservation_url }` |
| shopping | `{ must_buy }` |
| parking | `{ price, capacity, vehicle_limit }` |
| attraction | `{ duration_min, ticket_price }` |

### `trip_pois`（行程引用 = fork）

```sql
CREATE TABLE trip_pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id        INTEGER NOT NULL REFERENCES pois(id),

  -- 連結位置（這個 POI 在行程裡的角色）
  context       TEXT NOT NULL CHECK (context IN ('hotel','timeline','shopping')),
  day_id        INTEGER REFERENCES days(id) ON DELETE CASCADE,
  entry_id      INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  sort_order    INTEGER DEFAULT 0,

  -- 覆寫欄位（NULL = 用 master 值）
  description   TEXT,           -- 行程專屬描述（覆寫 pois.description）
  note          TEXT,           -- 行程專屬注意事項（永不同步回 master）
  hours         TEXT,           -- 覆寫營業時間

  -- 覆寫判斷：NULL = 用 master 值，非 NULL = 已覆寫（不需額外追蹤欄位）

  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(trip_id, poi_id, context, day_id, entry_id),
  -- 確保 context 與 FK 一致
  CHECK (
    (context = 'hotel' AND day_id IS NOT NULL) OR
    (context IN ('timeline','shopping') AND (entry_id IS NOT NULL OR day_id IS NOT NULL))
  )
);

CREATE INDEX idx_trip_pois_trip ON trip_pois(trip_id);
CREATE INDEX idx_trip_pois_poi ON trip_pois(poi_id);
CREATE INDEX idx_trip_pois_day ON trip_pois(day_id);
CREATE INDEX idx_trip_pois_entry ON trip_pois(entry_id);
```

### 保留的表（不變）

- `trips` — 不變
- `days` — 不變
- `entries` — 精簡（移除 restaurant/shopping 嵌入，改用 trip_pois 引用）
- `trip_docs` — 不變
- `requests` — 不變
- `permissions` — 不變
- `audit_log` — 不變

### 廢除的表（改名保留 30 天）

- `hotels` → RENAME TO `hotels_legacy`，合併進 `pois`（type=hotel）+ `trip_pois`（context=hotel）
- `restaurants` → RENAME TO `restaurants_legacy`，合併進 `pois`（type=restaurant）+ `trip_pois`（context=timeline）
- `shopping` → RENAME TO `shopping_legacy`，合併進 `pois`（type=shopping）+ `trip_pois`（context=shopping）

30 天後確認無問題再 DROP legacy 表。

### `entries` 精簡

```sql
-- 移除的欄位：無（entries 本身不嵌入 POI 資料）
-- entries 保持原樣，restaurants/shopping 改成透過 trip_pois 關聯

-- 原：entries → restaurants（FK entry_id）
-- 新：entries → trip_pois（FK entry_id, context='timeline'）→ pois

-- 原：entries → shopping（FK parent_id where parent_type='entry'）
-- 新：entries → trip_pois（FK entry_id, context='shopping'）→ pois
```

---

## API 查詢模式

### 讀取一天的資料（GET /api/trips/:id/days/:num）

```sql
-- 飯店（原 hotels JOIN）
SELECT p.*, tp.description AS override_description, tp.note, tp.hours AS override_hours,
       tp.overrides_json, tp.sort_order
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.day_id = ? AND tp.context = 'hotel';

-- 某 entry 的餐廳推薦
SELECT p.*, tp.description AS override_description, tp.note, tp.sort_order
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.entry_id = ? AND tp.context = 'timeline'
ORDER BY tp.sort_order;

-- 某 entry 的購物推薦
SELECT p.*, tp.description AS override_description, tp.note, tp.sort_order
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.entry_id = ? AND tp.context = 'shopping'
ORDER BY tp.sort_order;
```

### 前端合併邏輯（mapRow 層）

```typescript
function mergePoi(poi: Poi, tripPoi: TripPoi): MergedPoi {
  const overrides = JSON.parse(tripPoi.overrides_json || '[]');
  return {
    ...poi,
    // 覆寫欄位：有 override 用 override，沒有用 master
    description: overrides.includes('description') ? tripPoi.description : poi.description,
    hours: overrides.includes('hours') ? tripPoi.hours : poi.hours,
    // 行程專屬欄位：永遠用 trip_pois 的值
    note: tripPoi.note,
    sortOrder: tripPoi.sortOrder,
  };
}
```

### Sync 機制

**Master → Fork（pull）：**
- 當 pois master 更新（例如 google_rating 變了）
- 所有引用該 poi_id 的 trip_pois **未覆寫**的欄位自動反映新值（因為 JOIN 就是讀 master）
- 已覆寫的欄位不受影響（overrides_json 追蹤）
- **零成本**：不需要額外操作，JOIN query 天然就是最新的

**Fork → Master（push）：**
- 當 tp-edit/tp-patch skill 更新了 google_rating、hours 等「客觀事實」欄位
- 同時 UPDATE pois master
- `description`、`note` 等主觀欄位不回寫

```typescript
// 需要回寫 master 的欄位（客觀事實）
const SYNC_TO_MASTER = ['google_rating', 'hours', 'phone', 'address', 'maps', 'mapcode', 'location_json'];

// 不回寫的欄位（主觀/行程專屬）
const TRIP_ONLY = ['description', 'note'];
```

---

## FIELD_MAP 廢除 + 欄位統一

### 新 schema 直接用正確名稱

| 舊 | 新（pois） | 說明 |
|---|-----------|------|
| entries.body | entries.description | rename |
| entries.rating | entries.google_rating | rename |
| hotels.details | pois.description | 合併進 pois |
| hotels.rating | — | hotels 沒有 rating |
| restaurants.rating | pois.google_rating | 合併進 pois |
| restaurants.description | pois.description | 合併進 pois |
| shopping.note（描述）| pois.description | 合併進 pois |
| shopping.rating | pois.google_rating | 合併進 pois |

### mapRow 改造

```typescript
// 刪除 FIELD_MAP，改用自動轉換
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// JSON_FIELDS 保留
export const JSON_FIELDS = ['location_json', 'meta_json', 'weather_json', 'footer_json'];
```

---

## MarkdownText 統一渲染

### 新增 inline 模式

解決 `marked.parse()` 破壞 TEL/URL 的問題（PR #133 教訓）：

```typescript
// MarkdownText.tsx
interface MarkdownTextProps {
  text: string;
  as?: 'span' | 'div' | 'p';
  className?: string;
  inline?: boolean;  // 新增：使用 marked.parseInline()
}

export default function MarkdownText({ text, as: Tag = 'span', className, inline }: MarkdownTextProps) {
  const html = useMemo(
    () => inline ? sanitizeHtml(marked.parseInline(text) as string) : renderMarkdown(text),
    [text, inline]
  );
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### 渲染規則

| 欄位 | 模式 | 原因 |
|------|------|------|
| pois.description | `inline` | 可能含 TEL/URL/地址 |
| trip_pois.description | `inline` | 同上 |
| trip_pois.note | block（預設）| 注意事項可以有段落 |
| entries.description | block | 景點說明 |
| entries.note | block | 注意事項 |
| pois.meta_json.parking.note | `inline` | 停車說明 |

---

## 資料遷移策略

### Step 1: 建立 pois master（去重）

```javascript
// 遷移腳本邏輯
// 1. 收集所有 hotels/restaurants/shopping
// 2. 按 name + location 去重（fuzzy match）
// 3. 合併資料：取最完整的版本作為 master
// 4. 建立 poi_id 映射表
```

**去重規則：**
- 名稱正規化後相同 → 同一 POI
- 名稱相似 + 位置 <500m → 可能同一 POI（人工確認）
- 不同名稱 → 不同 POI

**名稱正規化：**
- 全形→半形（ＡＢＣ→ABC、１２３→123）
- 空格統一（全形空格→半形）
- 去掉尾部「店」字比對（「唐吉軻德 國際通店」=「唐吉軻德 國際通」）
- カタカナ/ひらがな 統一（同一家店可能混用）

### Step 2: 建立 trip_pois 引用

```javascript
// 對每個現有 hotel/restaurant/shopping
// 1. 找到對應的 pois master record
// 2. 比較欄位差異 → 差異部分記錄為 overrides
// 3. 建立 trip_pois record
```

### Step 3: 驗證 + 切換

- 新舊 API 平行輸出，diff 比較
- 確認所有行程顯示一致
- 切換路由到新 API

---

## 執行順序

```
1. D1 備份（已完成 ✅）
2. Migration: CREATE TABLE pois, trip_pois
3. Migration: entries RENAME COLUMN body→description, rating→google_rating
4. 遷移腳本：現有 hotels/restaurants/shopping → pois + trip_pois
5. mapRow.ts 改造（snakeToCamel 取代 FIELD_MAP）
6. API 端點重寫（JOIN pois + trip_pois）
7. TypeScript 型別更新（Poi, TripPoi, MergedPoi）
8. 前端元件更新 + MarkdownText 統一（含 inline 模式）
9. Sync 機制（fork→master 回寫）
10. 測試更新 + 全量驗證
11. 清除舊表（hotels, restaurants, shopping）
```

---

## 影響範圍

- Migration: 2 個新 SQL 檔案
- 遷移腳本: 1 個去重 + 建立引用的 script（含名稱正規化）
- API: 重寫 days/[num].ts 查詢 + 新增 /api/pois 端點
- mapRow: 重構（snakeToCamel 取代 FIELD_MAP）
- mapDay.ts: 移除 body/rating fallback 邏輯
- 前端: Hotel.tsx, Restaurant.tsx, Shop.tsx, InfoBox.tsx, types/trip.ts
- TripPage.tsx: CSV/Markdown export 更新欄位名（e.body→e.description, e.rating→e.googleRating）
- rollback.ts: 更新硬編碼 column list
- migrate-md-to-d1.js: 更新 INSERT 語句欄位名
- 測試: 大量更新（~15 新測試）
- Skills: tp-edit, tp-patch 加入 sync-to-master 邏輯

## 風險

- **最大風險：資料遷移去重**。同名但不同分店怎麼處理？（如「唐吉軻德 國際通店」vs「唐吉軻德 那霸店」）
- D1 不支援 CREATE TABLE ... AS SELECT（需用 INSERT INTO ... SELECT）
- JOIN 查詢效能需測試（D1 對 JOIN 的效能未知）
- 舊表刪除前需確認所有引用已遷移
- audit_log 的 diff_json 含舊欄位名 — 接受歷史不一致

## 不做的事

- ❌ 不建 POI 搜尋/瀏覽功能（只建 master 資料）
- ❌ 不建 POI 管理 UI（用 API + skill 維護）
- ❌ 不做跨行程 POI 推薦（未來功能）
- ❌ 不遷移 audit_log 舊 diff（歷史保持原樣）

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 2 premise fixes (remove overrides_json, add name normalization) |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 8 findings all auto-decided (P1-P5) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | SKIPPED | No UI scope (DB refactor) |
| Adversarial | auto | Cross-model | 0 | SKIPPED | Small plan, no adversarial needed |

**VERDICT:** APPROVED — CEO + Eng review passed. 5 corrections applied to plan.

### Decision Audit Trail

| # | Phase | Decision | Principle | Rationale |
|---|-------|----------|-----------|-----------|
| 1 | CEO | 移除 overrides_json | P5 explicit | NULL=master, 非NULL=覆寫 |
| 2 | CEO | 舊表 RENAME _legacy 保留 30 天 | P3 pragmatic | 降低風險 |
| 3 | CEO | 加入名稱正規化 | P1 completeness | 全形/半形差異 |
| 4 | CEO | meta_json 不拆獨立表 | P5 explicit | 欄位少，JSON 夠用 |
| 5 | CEO | 一次做完不分階段 | P3 pragmatic | 分階段更複雜 |
| 6 | Eng | mapDay fallback 全移除 | P3 pragmatic | schema 統一後不需要 |
| 7 | Eng | TripPage export 加入範圍 | P1 completeness | 直接存取欄位名 |
| 8 | Eng | rollback.ts 加入範圍 | P1 completeness | 硬編碼 column list |
