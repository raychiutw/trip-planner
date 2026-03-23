## ADDED Requirements

### Requirement: trips table
系統 SHALL 在 D1 建立 `trips` table，包含 id(PK)、name、owner、title、description、og_description、self_drive、countries、published、food_prefs、auto_scroll、footer_json、created_at、updated_at 欄位。

#### Scenario: 建立行程
- **WHEN** INSERT 一筆 trip
- **THEN** id 為 TEXT PRIMARY KEY（如 `okinawa-trip-2026-Ray`），created_at/updated_at 自動填入

### Requirement: days table
系統 SHALL 建立 `days` table，包含 id(PK)、trip_id(FK)、day_num、date、day_of_week、label、weather_json、updated_at 欄位，(trip_id, day_num) 為 UNIQUE。

#### Scenario: 查詢某天
- **WHEN** 以 trip_id + day_num 查詢
- **THEN** 回傳唯一一筆 day 記錄

### Requirement: hotels table
系統 SHALL 建立 `hotels` table，包含 id(PK)、day_id(FK UNIQUE)、name、checkout、source、details、breakfast、note、parking_json 欄位。每天最多一間飯店。

#### Scenario: 每天最多一間
- **WHEN** 同一 day_id 已有 hotel 時再 INSERT
- **THEN** UNIQUE 約束阻止重複

### Requirement: entries table
系統 SHALL 建立 `entries` table，包含 id(PK)、day_id(FK)、sort_order、time、title、body、source、maps、mapcode、rating、note、travel_type、travel_desc、travel_min、location_json、updated_at 欄位。

#### Scenario: 排序
- **WHEN** 查詢某天的 entries
- **THEN** 依 sort_order ASC 排序

### Requirement: restaurants table
系統 SHALL 建立 `restaurants` table，包含 id(PK)、entry_id(FK)、sort_order、name、category、hours、price、reservation、reservation_url、description、note、rating、maps、mapcode、source 欄位。

#### Scenario: 掛在 entry 下
- **WHEN** 查詢某 entry 的 restaurants
- **THEN** 回傳該 entry_id 下所有餐廳，依 sort_order 排序

### Requirement: shopping table
系統 SHALL 建立 `shopping` table，包含 id(PK)、parent_type('hotel'|'entry')、parent_id、sort_order、name、category、hours、must_buy、note、rating、maps、mapcode、source 欄位。

#### Scenario: 掛在 hotel 或 entry 下
- **WHEN** parent_type='hotel' 且 parent_id=飯店 id
- **THEN** 回傳該飯店附近的購物點

#### Scenario: 掛在 entry 下
- **WHEN** parent_type='entry' 且 parent_id=景點 entry id
- **THEN** 回傳該景點附近的購物點

### Requirement: trip_docs table
系統 SHALL 建立 `trip_docs` table，包含 id(PK)、trip_id(FK)、doc_type('flights'|'checklist'|'backup'|'suggestions'|'emergency')、content(TEXT)、updated_at 欄位，(trip_id, doc_type) 為 UNIQUE。

#### Scenario: 讀取航班
- **WHEN** 以 trip_id + doc_type='flights' 查詢
- **THEN** 回傳航班資訊純文字

### Requirement: CASCADE 刪除
所有子 table SHALL 設定 `ON DELETE CASCADE`，刪除行程時自動清除所有關聯資料。

#### Scenario: 刪除行程
- **WHEN** DELETE FROM trips WHERE id='xxx'
- **THEN** 該行程的 days、hotels、entries、restaurants、shopping、trip_docs 全部自動刪除
