# Proposal: POI Schema V2 — 正規化 + 零 JSON + 資料所有權

## 問題

### Phase 1 已完成（v1.1.1.0）
1. ✅ 欄位名稱統一（body→description, rating→google_rating）
2. ✅ 表名統一（trip_ 前綴）
3. ✅ mapRow pipeline 接線
4. ✅ MarkdownText 渲染

### Phase 2 待解決
1. **pois/trip_pois 空殼**：migration 0014 建了表但零資料、零 API、零前端接線
2. **三張獨立表不合理**：hotels/restaurants/shopping 各自為政，同一 POI 跨行程無法共用
3. **JSON 欄位**：pois.location TEXT 存 JSON、pois.attrs TEXT 存 JSON — 違反正規化
4. **停車場寄生在飯店**：parking 是 JSON 塞在 hotels.parking，有名稱+位置的停車場應為獨立 POI
5. **資料所有權不明**：user 修改和 AI 生成混在同一欄位，無法區分來源

## 設計原則

1. **pois + trip_pois 是唯一 POI 資料來源** — 廢除 hotels/restaurants/shopping 獨立表
2. **零 JSON 欄位** — lat/lng/parking/breakfast 全部拆成獨立欄位
3. **類型專屬欄位用 extension table** — trip_poi_hotels / trip_poi_restaurants / trip_poi_shopping
4. **資料所有權分離**：
   - `pois` master = AI 生成（tp-create/tp-edit/tp-patch/tp-rebuild），user 不可直接改
   - `trip_pois` = user 可覆寫（description/note），前端用 COALESCE 合併
5. **停車場是獨立 POI** — 有名稱+位置的停車場建 pois(type='parking')，純停車說明寫在 description

## Schema

### pois（master — 跨行程共用，AI 維護）
```sql
id, type ('hotel'|'restaurant'|'shopping'|'parking'|'attraction'|'transport'|'other')
name, description, note
address, phone, email, website, hours
google_rating REAL, category
maps, mapcode, lat REAL, lng REAL    -- 不再是 JSON
country, source, created_at, updated_at
```

### trip_pois（trip 引用 — user 可覆寫）
```sql
id, trip_id FK, poi_id FK
context ('hotel'|'timeline'|'shopping')
day_id FK, entry_id FK, sort_order
parent_trip_poi_id FK (NULL)         -- 停車場→飯店、附屬店→景點
description, note, hours             -- 覆寫 master
source, created_at, updated_at
```

### trip_poi_hotels（飯店專屬）
```sql
trip_poi_id FK (1:1)
checkout, breakfast_included INT, breakfast_note
```

### trip_poi_restaurants（餐廳專屬）
```sql
trip_poi_id FK (1:1)
price, reservation, reservation_url
```

### trip_poi_shopping（購物專屬）
```sql
trip_poi_id FK (1:1)
must_buy
```

## 資料流

```
寫入：
  tp-create  → INSERT pois (AI) + INSERT trip_pois (引用) + INSERT extension
  tp-edit    → user 說「改描述為 X」→ UPDATE trip_pois.description (user 覆寫)
             → user 說「重寫介紹」→ AI 重新生成 → UPDATE pois.description (master)
  tp-patch   → UPDATE pois (客觀欄位: google_rating/hours/phone)
  user PUT   → UPDATE trip_pois only（禁止直接改 pois）

讀取：
  GET /days/:num → trip_pois JOIN pois
                 → LEFT JOIN extension tables
                 → 前端用 COALESCE(trip_pois.field, pois.field)
```

## Skill Markdown 分段規則

POI description 依資訊類型分段落：
- 飯店：位置與交通 / 設施與服務 / 餐食資訊 / 停車說明
- 景點：概述 / 遊玩重點 / 實用資訊
- 餐廳：特色與推薦 / 用餐須知
- 購物：特色商品 / 營業與交通資訊

## 停車場處理

- 有具體停車場（名稱+位置+價格）→ 獨立 pois(type='parking') + trip_pois(parent_trip_poi_id→飯店)
- 只是停車說明（「飯店有免費停車」）→ 寫在飯店 description 段落

## Migration 策略

1. Migration 0015：DROP 空的 pois/trip_pois + 重建（新 schema）+ CREATE extension tables
2. 更新 migrate-pois.js：從 hotels/restaurants/shopping 讀 → 寫入新表
3. 跑 migration + 資料遷移
4. API 改為查 pois + trip_pois + extension tables
5. 舊表 RENAME 為 _legacy（不刪，保留回滾能力）
6. 更新 CLAUDE.md / skills / seed.sql
