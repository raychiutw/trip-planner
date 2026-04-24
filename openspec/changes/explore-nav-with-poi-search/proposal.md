## Why

Q5 locked：探索 nav 為 B scope（search + 儲存池 + 加入 trip）。Phase 2 建了 `/explore` placeholder，Phase 1 建了 `saved_pois` schema + `/api/saved-pois` API；此 Phase 填充 /explore 真正功能，讓 trip-planner 有 Mindtrip 級 discovery 入口，陌生人首次來網站可先探索而非硬性建 trip。

## What Changes

- **新 `<ExplorePage>` component**：包 2 section（搜尋 + 儲存池），sticky top category filter
- **POI search provider 整合**：首選 **OSM Nominatim**（免費 + 無 API key）；若品質不足再補 Google Places 付費層級
- **Search 功能**：text search + category filter（景點 / 餐廳 / 飯店 / 購物，對齊 trip-planner 既有 POI types）+ location bias（當前 trip 或手動選 region）
- **儲存池 UI**：list of saved POI cards，點 `+` icon 選 trip → 加到該 trip 的 ideas（呼叫 Phase 1 的 `POST /api/trip-ideas`）
- **Save action**：search 結果 POI 有 heart icon，點擊 `POST /api/saved-pois`
- **手機 Explore layout**：地圖上半 + category tabs + POI cards horizontal scroll（Mindtrip Image 5 pattern）
- **桌機 Explore layout**：search + filter sidebar + 結果 grid（不同於 Mindtrip 純 map-first，trip-planner 桌機給更多 visual 空間）

## Capabilities

### New Capabilities

- `explore-page`: 全站 `/explore` 頁面，包含搜尋 section + 儲存池 section + 從儲存池加到 trip 的 promote flow
- `poi-search`: POI 搜尋 API（query + category + region bias），串接 OSM Nominatim provider，結果格式統一為 trip-planner 既有 POI schema

### Modified Capabilities

（無既有相關 spec；Phase 2 的 ExplorePage 只是 placeholder，此 Phase 為首次定義）

## Impact

- **新 files**：
  - `src/pages/ExplorePage.tsx`（replace Phase 2 placeholder）
  - `src/components/explore/ExploreSearch.tsx`
  - `src/components/explore/ExploreSavedPool.tsx`
  - `src/components/explore/ExplorePoiCard.tsx`
  - `functions/api/poi-search.ts`（新 endpoint wrap Nominatim + 轉格式）
- **修改 files**：
  - `src/types/api.ts` 新 `PoiSearchResult` interface
- **外部依賴**：
  - Nominatim API（免費 public endpoint + User-Agent header）
  - 或 Mapbox Geocoding（若有 TODO token）
- **Rate limit 策略**：Nominatim 限每秒 1 request → Cloudflare Workers 加 cache（R2 或 KV cache 熱門 query 1h）
- **手機 UX**：map + drag handle + cards stack（Mindtrip pattern，但 map 部分可能選擇先不做，Phase 6 再加）
- **Breaking**：無（`/explore` 從 placeholder 換真實內容不是 breaking）
