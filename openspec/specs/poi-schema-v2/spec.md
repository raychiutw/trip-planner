## ADDED Requirements

### Requirement: POI Schema V2 — 正規化 + 零 JSON + 扁平化

#### Scenario: pois master 表
- **THEN** SHALL 包含 20 欄位：id, type, name, description, note, address, phone, email, website, hours, google_rating, category, maps, mapcode, lat, lng, country, source, created_at, updated_at
- **AND** type SHALL CHECK IN ('hotel','restaurant','shopping','parking','attraction','transport','other')
- **AND** 零 JSON 欄位（lat/lng 獨立 REAL 欄位）

#### Scenario: trip_pois fork 表
- **THEN** SHALL 包含覆寫欄位（description, note, hours）+ 類型專屬欄位（checkout, breakfast_*, price, reservation*, must_buy）
- **AND** context SHALL CHECK IN ('hotel','timeline','shopping')
- **AND** hotel context SHALL 要求 day_id NOT NULL
- **AND** timeline/shopping context SHALL 要求 entry_id OR day_id NOT NULL
- **AND** FK ON DELETE CASCADE 到 trips, trip_days, trip_entries

#### Scenario: poi_relations 關聯表
- **THEN** SHALL 支援 parking/nearby 兩種 relation_type
- **AND** UNIQUE(poi_id, related_poi_id, relation_type)
- **AND** FK ON DELETE CASCADE 到 pois

#### Scenario: POI 去重（find-or-create）
- **WHEN** PUT /api/trips/:id/days/:num 插入 POI
- **THEN** SHALL 先查 pois WHERE name = ? AND type = ? LIMIT 1
- **AND** 已存在 SHALL COALESCE update（只填 NULL 欄位，不覆寫）
- **AND** 不存在 SHALL INSERT INTO pois RETURNING id

#### Scenario: PATCH /api/pois/:id（admin only）
- **WHEN** admin PATCH master POI
- **THEN** SHALL 更新 16 個允許欄位
- **AND** 非 admin SHALL 回傳 403

#### Scenario: 表名統一
- **THEN** days → trip_days, entries → trip_entries, requests → trip_requests, permissions → trip_permissions
- **AND** 所有 API handler 和測試 SHALL 使用新表名

#### Scenario: Migration 安全
- **GIVEN** migration 0014（表名統一 + pois/trip_pois 初建）+ 0015（V2 重建）+ 0016（schema cache fix）
- **THEN** 0015 SHALL 先 DROP 空表再重建（0014 建的舊 schema 無資料）
- **AND** 0016 SHALL 處理 D1 schema cache 問題
