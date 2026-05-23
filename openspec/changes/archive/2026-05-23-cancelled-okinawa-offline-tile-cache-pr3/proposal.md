# Okinawa Offline Map (PR3) — Static Maps fallback

**Status**: 🟡 Proposal — open Q2-Q5 仍待 user sign-off

**Constraint**: 2026-05-23 user 確認「以後只使用 google map api」(memory
[[feedback_google_maps_only]])。Google Maps Platform ToS 第 3.2.4.b 明禁
pre-fetch / cache **interactive tiles** → 原 proposal 的 Phase 1 A/B/C
（service worker tile cache）方案 **作廢**。

**唯一合 ToS 路徑**：用 **Google Static Maps API**（ToS 明文允許 cache
up to 30 days）pre-render 每 day 的地圖 snapshot 圖檔，存 IndexedDB，
網路 fail 時 fallback 顯示靜態地圖。

**Driver**: Ray 7/26-8/1 Okinawa trip。沖繩北部山區 / 海邊死角 4G/5G 訊號
不穩 + 漫遊流量 cap 焦慮。

## Why

Current state：v2.23.0 Google Maps JS API tile 都 server-side fetch，無 cache。
離線 → 白塊。

User pain (memory `project_okinawa_network_offline`)：
- 沖繩 7/26-8/1 trip 7 天，地圖是主要 navigation
- 北部 / 海邊死角無 signal
- 漫遊流量 cap，後續日子可能耗光
- 行程資料已 cache（D1 → IndexedDB via React Query）但地圖沒 offline path

無 interactive offline map 的妥協：靜態地圖 image，可看 marker 位置但
不能 pan / zoom。對「死角看景點大致方位」這個核心需求**已足夠**。

## What Changes

### Phase 1 — Static Map snapshot per day（核心 Q1 答案）

每 day 一張 Static Map PNG，含當天所有 entries 的 markers。

**Backend**：
- 新 endpoint `POST /api/trips/:id/days/:num/static-map`：算當天 entries
  bbox + center，組 `https://maps.googleapis.com/maps/api/staticmap?...`
  URL（500×500 PNG, zoom auto-fit, markers=color:red|lat,lng|...），fetch
  → return base64 data URL OR 直接 redirect to Static Maps URL（簽 token
  避免 hot-link 濫用）
- 結果 cache 在 D1 `trip_days.static_map_url` 或 `trip_days.static_map_blob`
  （TBD per Q3 quota）；24h refresh window
- New migration: ADD COLUMN `static_map_url TEXT, static_map_etag TEXT,
  static_map_refreshed_at TEXT`

**Frontend**：
- `<OceanMap>` 包 fallback layer：interactive map fail to load → `<img
  src={day.staticMapUrl}>` overlay
- Static map blob 存 IndexedDB via React Query persisted cache（既有
  infrastructure）
- 不需 service worker — React Query persistent cache 已處理 offline

### Phase 2 — Pre-cache trigger UI（Q2 待定）

依 Q2 答案 scope：

- **(A) 最簡** — Trip detail 加「下載離線地圖」一鍵 → fire N requests
  for N days，全 cache 完 toast 通知
- **(B) 中等** — per-day download / cancel + progress
- **(C) 進階** — quota meter

**推薦 (A)** — 7 天 × 1 image × ~80KB ≈ 560KB total，IndexedDB cap 50MB
完全 ok，不需 quota UI。

### Phase 3 — Offline banner + fallback (Phase 1 自動覆蓋)

- `<OceanMap>` 加 `data-offline` state when tiles fail-load > 5s
- Show 「目前離線 — 顯示靜態地圖」banner
- Static map fallback layer 自動 show（pre-cached blob）

### Phase 4 — implementation surface

1. `migrations/00XX_trip_days_static_map.sql` — ADD COLUMN × 3
2. `functions/api/trips/[id]/days/[num]/static-map.ts` — POST endpoint
3. `src/lib/offlineMap.ts` — bbox/center calc + Static Maps URL builder
4. `src/components/trip/OceanMap.tsx` — fallback `<img>` overlay + offline detect
5. `src/components/trip/OfflineBanner.tsx`（optional, 看 UX 是否需要）
6. `src/pages/TripPage.tsx` 或 trip detail menu — 加「下載離線地圖」action（per Q2）

### Phase 5 — Quota & refresh

- Google Static Maps 第 1 萬 request/month 免費，超過 $2 / 1K
- 沖繩 trip 7 days × 1 image = 7 requests one-shot；refresh 24h 才 fire
  → 月底 ~210 requests，遠低於 quota
- IndexedDB store 600KB per trip — 50 個 trips ≈ 30MB，安全

## Open Questions (post-Q1 update)

✅ **Q1 — Maps provider** 已決定：**Google Static Maps**（per
[[feedback_google_maps_only]]）。原 Mapbox / MapTiler 選項作廢。

🟡 **Q2 — Pre-cache UI 複雜度**：
- (A) 一鍵全 download（推薦，7 圖只要 5s）
- (B) per-day 控制
- (C) progress + quota UI

🟡 **Q3 — Static map storage**：
- (A) `trip_days.static_map_url TEXT` — 存 signed URL，client fetch → blob
- (B) `trip_days.static_map_blob TEXT` — base64 直接存 D1（破 1MB row 限制？）
- (C) Client-only：D1 不存，IndexedDB only via React Query persisted cache

🟡 **Q4 — Offline detection**：
- (A) Tile fetch fail rate（準但 5s 延遲才判定）
- (B) `navigator.onLine`（瞬時但 false positive）
- (C) 結合：先 (B) snap，5s 後驗 (A)

🟡 **Q5 — Refresh cadence**：
- 行程改動（新增 entry / 改座標）→ 自動失效 static map cache？
- TTL 24h 自動 refresh OR 永久（user 主動觸發）？

## Risks

- **Static map 無互動** — user 不能 zoom 看細節。Mitigation：trip detail
  已有 timeline list + 地址 + 開地圖 button 跳系統 Google Maps app（離線
  仍可用 system app 的 offline cache）
- **D1 row size 1MB cap** — 若選 Q3-B base64 存 D1，500×500 PNG ~80KB 安全；
  但若放大到 2048×2048 ~400KB 接近上限
- **Static Maps quota 預算** — 25K requests/month free tier，超過 $2/1K。
  Daily check 監控 usage

## Tests

- Unit: `offlineMap.ts` bbox + Static Maps URL builder + marker encoding
- Integration: `POST /api/trips/:id/days/:num/static-map` 簽 URL + cache logic
- E2E (playwright): trip detail → 「下載離線地圖」→ 7 toasts → toggle
  offline mode → `<OceanMap>` fallback 顯示 static image
- Manual QA: 沖繩出發前真機（iPhone Safari + Android Chrome）模擬 airplane mode

## Effort Estimate (per Q2 答案調整)

- Q2 = (A) 最簡：3-5 工作天
- Q2 = (B) 中等：5-7 工作天
- Q2 = (C) 進階：7-10 工作天

剩 ~2 個月到 7/26 deadline，**(A) 最簡** 推薦。

## Out of Scope

- Interactive offline map（與 Google ToS 衝突，永遠不做）
- Offline POI search / 路線規劃（保留 online-only）
- 多 trip 同時 offline（先支援 single active trip）

## Next Steps

1. ⏸ User answer Q2-Q5
2. `/tp-claude-design` mockup（trip detail「下載離線地圖」action + offline
   fallback banner UX）
3. Sign-off mockup
4. Build phases 1-4 sequentially（migration first → endpoint → frontend）
