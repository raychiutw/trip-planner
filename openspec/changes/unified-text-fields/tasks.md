## F001：DB Migration — 新表 + 欄位 Rename

- [ ] F001.1 建立 `migrations/0014_pois.sql` — CREATE TABLE pois（id, type, name, description, address, phone, email, website, hours, google_rating, category, maps, mapcode, location_json, meta_json, country, source, created_at, updated_at）
- [ ] F001.2 建立 `migrations/0014_pois.sql` — CREATE TABLE trip_pois（id, trip_id, poi_id, context, day_id, entry_id, sort_order, description, note, hours, source, created_at, updated_at）+ CHECK constraint + indexes
- [ ] F001.3 建立 `migrations/0014_pois.sql` — ALTER TABLE entries RENAME COLUMN body TO description
- [ ] F001.4 建立 `migrations/0014_pois.sql` — ALTER TABLE entries RENAME COLUMN rating TO google_rating
- [ ] F001.5 驗證 D1 ALTER TABLE RENAME COLUMN 支援（wrangler d1 execute --local 測試）

**依賴**：D1 備份已完成

---

## F002：資料遷移腳本

- [ ] F002.1 建立 `scripts/migrate-pois.js` — 讀取 hotels/restaurants/shopping 全部資料
- [ ] F002.2 實作名稱正規化函數 — 全形→半形、空格統一、去尾「店」字、カタカナ統一
- [ ] F002.3 實作去重邏輯 — 正規化後同名 → 合併為同一 POI master，取最完整版本
- [ ] F002.4 建立 pois master records — INSERT 去重後的 POI，type 依來源表決定（hotel/restaurant/shopping）
- [ ] F002.5 建立 trip_pois 引用 — 對每個原始 hotel/restaurant/shopping 建立 trip_pois 引用，比較差異記錄覆寫
- [ ] F002.6 舊表改名 — RENAME hotels→hotels_legacy, restaurants→restaurants_legacy, shopping→shopping_legacy
- [ ] F002.7 驗證遷移完整性 — 比較遷移前後 API 回傳是否一致

**依賴**：F001

---

## F003：mapRow 改造

- [ ] F003.1 新增 `snakeToCamel()` 函數，取代手動 FIELD_MAP
- [ ] F003.2 刪除 FIELD_MAP 常數
- [ ] F003.3 更新 JSON_FIELDS（移除 overrides_json，新增 meta_json）
- [ ] F003.4 更新 `tests/unit/map-row.test.js` — 移除 FIELD_MAP 測試，改測 snakeToCamel
- [ ] F003.5 驗證所有 24 個 snake_case 欄位自動轉換結果與現有前端 key 一致

**依賴**：F001

---

## F004：API 端點重寫

- [ ] F004.1 重寫 `functions/api/trips/[id]/days/[num].ts` GET — JOIN pois + trip_pois 取代 hotels/restaurants/shopping 獨立查詢
- [ ] F004.2 重寫 `functions/api/trips/[id]/days/[num].ts` PUT — 寫入 trip_pois 取代 hotels/restaurants/shopping INSERT
- [ ] F004.3 更新 `functions/api/trips/[id]/entries/[eid].ts` — ALLOWED_FIELDS 改用 description/google_rating
- [ ] F004.4 新增 `functions/api/pois.ts` — GET /api/pois（列表）+ GET /api/pois/:id（單筆）
- [ ] F004.5 新增 trip_pois CRUD — POST/PATCH/DELETE trip_pois 引用
- [ ] F004.6 更新 `functions/api/trips/[id]/audit/[aid]/rollback.ts` — column list 更新
- [ ] F004.7 更新 restaurants/shopping/hotels endpoint 指向 trip_pois（向下相容或移除）
- [ ] F004.8 實作 sync fork→master — 客觀欄位（google_rating/hours/phone）寫入時同時 UPDATE pois

**依賴**：F001, F002, F003

---

## F005：TypeScript 型別 + 前端資料層

- [ ] F005.1 新增 `src/types/trip.ts` — Poi, TripPoi, MergedPoi interface
- [ ] F005.2 更新 Hotel interface — details→description (string, 非 string[])
- [ ] F005.3 更新 Entry interface — 註解更新（body→description, rating→google_rating 已在 DB 層修正）
- [ ] F005.4 重寫 `src/lib/mapDay.ts` — 移除 body/rating fallback，新增 mergePoi 合併邏輯
- [ ] F005.5 更新 `src/pages/TripPage.tsx` — CSV/Markdown export 欄位名（e.body→e.description, e.rating→e.googleRating）

**依賴**：F003, F004

---

## F006：前端元件 + MarkdownText 統一

- [ ] F006.1 MarkdownText 新增 `inline` prop — 使用 `marked.parseInline()` 避免破壞 TEL/URL
- [ ] F006.2 更新 Hotel.tsx — description 用 `<MarkdownText inline>`，note 用 `<MarkdownText>`
- [ ] F006.3 更新 InfoBox.tsx ParkingBox — note 用 `<MarkdownText inline>`
- [ ] F006.4 更新 InfoBox.tsx ReservationBox — notes 用 `<MarkdownText>`
- [ ] F006.5 更新 InfoBox.tsx SouvenirBox — item.note 用 `<MarkdownText inline>`
- [ ] F006.6 更新 InfoBox.tsx default — content 用 `<MarkdownText>`
- [ ] F006.7 更新 Shop.tsx — description 用 `<MarkdownText inline>`
- [ ] F006.8 更新 Restaurant.tsx — note 用 `<MarkdownText inline>`

**依賴**：F005

---

## F007：測試 + 驗證

- [ ] F007.1 更新 `tests/unit/entry-validation.test.ts` — body→description, rating→googleRating
- [ ] F007.2 更新 `tests/unit/restaurant-validation.test.ts` — rating→googleRating
- [ ] F007.3 更新 `tests/e2e/api-mocks.js` — 所有 mock 回應更新欄位名
- [ ] F007.4 新增 pois/trip_pois CRUD 測試
- [ ] F007.5 新增 mergePoi 合併邏輯測試（master 值 vs 覆寫值）
- [ ] F007.6 新增 MarkdownText inline 測試（TEL/URL 不被破壞）
- [ ] F007.7 新增 snakeToCamel 測試
- [ ] F007.8 更新 `scripts/migrate-md-to-d1.js` — INSERT 語句欄位名
- [ ] F007.9 全量 tsc + test + build 驗證

**依賴**：F004, F005, F006

---

## F008：Skills 更新

- [ ] F008.1 更新 tp-edit skill — 寫入 trip_pois 取代直接寫 restaurants/shopping
- [ ] F008.2 更新 tp-patch skill — sync-to-master 邏輯（客觀欄位回寫 pois）
- [ ] F008.3 更新 tp-create skill — 建行程時建立 pois master + trip_pois 引用
- [ ] F008.4 更新 tp-rebuild/tp-rebuild-all — 適配新 schema
- [ ] F008.5 更新 naming-rules.md — 移除 FIELD_MAP 相關說明

**依賴**：F004

---

## F009：trip_docs content JSON → Markdown

- [ ] F009.1 建立 `scripts/migrate-trip-docs.js` — 讀取所有 trip_docs，將 JSON content 轉成 markdown
- [ ] F009.2 flights：segments 轉 markdown 表格 + airline 資訊
- [ ] F009.3 checklist：cards + items 轉 `- [ ]` checklist（按分類分段）
- [ ] F009.4 backup：cards + weatherItems 轉按天分段列表
- [ ] F009.5 suggestions：cards + priority 轉按優先級分段列表
- [ ] F009.6 emergency：cards + contacts 轉列表（含 `[電話](tel:xxx)` 連結）
- [ ] F009.7 更新前端渲染元件 — 移除 JSON 解析邏輯，改用 MarkdownText
- [ ] F009.8 更新 tp-create / tp-rebuild skill — AI 生成時直接輸出 markdown

**依賴**：F006（MarkdownText）
