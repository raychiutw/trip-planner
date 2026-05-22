# Okinawa Offline Tile Cache (PR3)

**Status**: 🟡 Proposal — user sign-off pending（mockup + scope clarification needed before build）

**Driver**: Ray 7/26-8/1 Okinawa trip。沖繩部分區域（北部山區 / 海邊死角）4G/5G
signal 不穩，user reports「地圖白塊」+ 漫遊流量上限焦慮。

## Why

Current state：v2.23.0 Google Maps JS API 完全 server-side tile fetch。
無 cache，每次開地圖都重新 download tiles。離線 = white tiles。

User pain (memory `project_okinawa_network_offline`)：
- 沖繩 7/26-8/1 trip 7 天行程，地圖是主要 navigation
- 部分區域死角 (北部 / 海邊) 跑網路無 signal
- 漫遊流量 cap 後續日子可能耗光
- 行程資料已 download (D1 → IndexedDB cache via React Query) 但地圖 tile
  沒 offline path

PR3 = trip-planner v2 roadmap 第 3 個必做 PR for 7/26 trip ship。

## What Changes

### Phase 1: tile caching strategy（必選 1）

**A. Service Worker + Cache API tile interception（推薦）**

- 在 `public/sw.js` 註冊 service worker，攔截 `maps.googleapis.com/...tile...`
  request
- Cache strategy: `staleWhileRevalidate`（先回 cache，背景更新）
- Cache key: tile URL (含 zoom/x/y/styles)
- Quota: ~50MB IndexedDB（沖繩主要區域 zoom 12-16 ~3000 tiles × 15KB
  ~45MB）
- Eviction: LRU when quota reach

**B. Pre-download trip area on planner**

- New page `/trip/:id/offline` 「下載離線地圖」UI
- User 按下 → 算 trip bbox（所有 entries + destinations 含 padding）
- 跨 zoom 12-16 列舉 tiles + sequentially fetch & cache
- Progress UI (X/Y tiles, MB used)
- Settings → 看 quota / 清 cache

**C. Hybrid（A + B）**

- 平常瀏覽 → service worker 自動 cache（A）
- 預先 cache → user 主動 trigger（B）
- 同一個 Cache Storage entry

**選 C 推薦** — A 給日常瀏覽自動省流量，B 給離線前手動預載。

### Phase 2: 落地 fallback（必選 1）

**D. White-tile 偵測 + 通知**

- `map.tilesloaded` event 觸發 → check viewport tile 是否全 cache hit
- 沒 cache hit + 網路 fail → 顯示「地圖載入失敗 — 已離線」banner
- 此 banner 引導 user 進 `/trip/:id/offline` pre-download

**E. Static map 後備**

- Pre-render 每 day 的 static map image (Google Static Maps API)
- 存 D1 `trip_days.static_map_url` (signed URL OR base64 in IndexedDB)
- Network fail → fallback 顯 static png（無 pan/zoom，只看位置）

**選 D 推薦** — E 流量更省但 UX 差（不能互動）。

### Phase 3: tile attribution + ToS（必做）

Google Maps Platform ToS 第 3.2.4.b：「You will not pre-fetch, cache, or
store any Content」— **明顯禁止 pre-download tiles**。

Workaround：
- **F1. 改用 OpenStreetMap tile server (Carto / Stadia)** for offline mode only
- **F2. 跟 Google 簽 Premium plan** — Premium 允許某些 cache 形式
- **F3. 用 MapTiler / Mapbox Vector tiles** with offline SDK
- **F4. Self-host raster tiles** — own server tiles, ToS 自由

**選 F3 推薦** — Mapbox / MapTiler 有正式 offline SDK，每月 free tier
50K tile downloads。沖繩主要區域 ~3000 tiles 一次性 cache 足夠。

### Phase 4: implementation surface

1. `public/sw.js` — service worker（A path）
2. `src/lib/offlineMap.ts` — Cache Storage helper + tile bbox enumeration
3. `src/pages/TripOfflinePage.tsx` — `/trip/:id/offline` UI（B path）
4. `src/components/trip/OfflineBanner.tsx` — D path UX
5. `src/hooks/useGoogleMap.ts` 改造或 `src/hooks/useMapTilerMap.ts` 新 hook（F3 path）
6. `migrations/00XX_trip_days_static_map_url.sql`（E fallback if 用）
7. `functions/api/admin/static-map-prerender.ts`（E fallback if 用）

## Open Questions

1. **Maps provider 切換**：v2.23.0 已 Google Maps，要換 Mapbox/MapTiler 嗎？
   切換成本 ~3-5 天（OceanMap / LocationPickerMap / GlobalMap rewrite）。
   或：留 Google for 線上 + Mapbox vector for offline only（2 lib coexist
   多 300KB bundle）。

2. **User UI 觸發 pre-download 多複雜**：
   - 最簡：trip detail page 加「下載離線地圖」按鈕 → 全行程一次 cache
   - 進階：per-day download / cancel / quota meter / map zoom selector

3. **Quota 上限**：50MB 對沖繩 7 天主要區域夠。要支援更大行程
   (台灣環島 14 天) 嗎？目前 IndexedDB 通常上限 ~50%/100MB per origin。

4. **Offline detection**：用 `navigator.onLine` (false positive 高) 還是
   tile fetch fail rate (準但延遲)？

5. **Service worker version 管理**：第一次 ship 後升級 sw.js 要怎麼處理
   既有 cache invalidate？(cache key 含 version?)

## Risks

- **Google ToS 違反**：若沿用 Google Maps + cache → ToS violation。必須換
  provider。
- **Mapbox/MapTiler vendor lock-in**：style 不同，需重做 marker / polyline
  styling。
- **Quota exceeded**：iOS Safari quota 嚴格 (~50MB)，user 行程 cache 一半被踢
  → 沒提示就壞掉。要加 quota meter UI。
- **Service worker debugging**：dev 環境 SW 不啟，prod 才測得到。增 QA 成本。

## Tests

- Unit: `lib/offlineMap.ts` bbox enumeration + cache key derivation
- Integration: service worker fetch intercept + cache hit/miss
- E2E (playwright): pre-download trip → toggle offline → 地圖仍 render
- Manual QA: 沖繩出發前真機測試（iPhone Safari + Android Chrome）

## Effort Estimate

- Phase 1 + 3 (provider 切 + service worker)：3-5 天
- Phase 2 (pre-download UI)：2-3 天
- Phase 4 (banner + fallback)：1-2 天
- E2E + manual QA：1-2 天

Total: **8-12 工作天**（依 maps provider 切換決策）。

## Out of Scope

- Offline POI search（用既有 D1 cache，無 search index）
- Offline routing（Google Routes 無 offline，留 online-only）
- 多 trip 同時 offline（先做 single active trip）

## Next Steps

1. ⏸ User sign-off on key decisions:
   - (a) Maps provider strategy (留 Google 線上 + Mapbox offline, or 整套換)
   - (b) UI complexity (一鍵下載 / per-day / progress meter)
   - (c) Effort budget vs 7/26 deadline (剩 ~2 個月)
2. `/tp-claude-design` mockup（offline page + banner UX）
3. /office-hours 確認 scope
4. Build phases incrementally（first vertical slice: trigger + cache + view）
