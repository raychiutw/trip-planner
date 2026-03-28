# Design: POI 正規化 + 欄位統一 + Markdown 渲染

## 資料模型

### 現況（扁平嵌入式）

```
trips → days → hotels（1:1 嵌入，details/note/parking_json）
             → entries → restaurants（1:N 嵌入）
                       → shopping（polymorphic parent_type/parent_id）
```

問題：同一 POI 跨行程重複（飯店 71%、購物 39%），欄位命名 4 種混用。

### 新架構（正規化 fork/sync）

```
pois（master source of truth）
  ├── type: hotel | restaurant | shopping | parking | attraction | ...
  ├── 共用欄位：name, description, address, phone, email, hours, google_rating, maps, mapcode, location_json
  └── meta_json：類型專屬欄位（hotel→checkout/breakfast/parking, restaurant→price/reservation）

trip_pois（行程引用 = fork）
  ├── poi_id FK → pois
  ├── trip_id + context（hotel/timeline/shopping）+ day_id/entry_id
  ├── 覆寫欄位：description, note, hours（NULL = 用 master）
  └── 行程專屬：note（永不回寫 master）

entries（精簡，保留自身欄位）
  ├── description（原 body，RENAME）
  ├── google_rating（原 rating，RENAME）
  └── 不再嵌入 restaurants/shopping（改用 trip_pois 關聯）
```

### Sync 機制

```
Master → Fork：JOIN 查詢天然最新（零成本）
Fork → Master：客觀欄位（google_rating/hours/phone）回寫，主觀欄位不回寫
觸發：tp-edit / tp-patch skill 更新時自動 sync
```

## API 查詢模式

```sql
-- 一次 JOIN 取該天所有 POI（取代原本 5 個 SELECT）
SELECT p.*, tp.description AS tp_description, tp.note AS tp_note,
       tp.hours AS tp_hours, tp.context, tp.entry_id, tp.day_id, tp.sort_order
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.day_id = ?
ORDER BY tp.context, tp.entry_id, tp.sort_order
```

前端合併：`tp_description ?? p.description`（覆寫優先）

## MarkdownText 統一渲染

| 欄位 | 模式 | 原因 |
|------|------|------|
| pois.description | inline | 可能含 TEL/URL |
| trip_pois.description | inline | 同上 |
| trip_pois.note | block | 注意事項可有段落 |
| entries.description | block | 景點說明 |
| entries.note | block | 注意事項 |
| meta_json.parking.note | inline | 停車說明 |

## FIELD_MAP 廢除

```typescript
// 刪除手動映射，改用自動轉換
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
```

DB 欄位直接取正確名字（description, google_rating），snakeToCamel 自動轉。

## 去重策略

名稱正規化：全形→半形、空格統一、去尾「店」字、カタカナ/ひらがな 統一。
同名 → 同一 POI。相似 + 位置 <500m → 人工確認。
