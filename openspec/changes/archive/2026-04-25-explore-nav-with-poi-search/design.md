## Context

`/explore` 是 Mindtrip 化的 discovery 入口。使用者從這裡搜尋新 POI、累積儲存池、挑選加到某 trip 的 Ideas 清單。Mindtrip Image 5 顯示手機 Explore = 地圖 + category chips + POI cards with heart/plus icon。

trip-planner 的差異化 (Q5 locked)：**無 heart-on-card distributed pattern**，改在 Explore 頁面內有明確「儲存」button；**合併 Save + Explore 成一個 nav**；桌機 layout 不 map-first 而是 grid-oriented（暖調雜誌風符合 DESIGN.md）。

## Goals / Non-Goals

**Goals:**
- ship 一個可用的 `/explore` page
- 搜尋真的 work（用免費 OSM Nominatim）
- 儲存 POI 呼叫 Phase 1 的 `POST /api/saved-pois`
- 從儲存池加 POI 到某 trip 的 Ideas（呼叫 Phase 1 的 `POST /api/trip-ideas`）
- Category filter 對齊既有 POI types（sight, food, hotel, shopping）

**Non-Goals:**
- 不整合 Google Places（付費 + API key 管理複雜）— 若 Nominatim 品質不足未來升級
- 不做 Mindtrip 式桌機地圖 split pane（桌機 grid layout 優先）
- 不做進階 filter（開放時間、評分、價位等）— 先簡化
- 不做 AI-powered personalization（Mindtrip 有 "For you" tab）
- 不做 Inspiration / Collections（Mindtrip 有 sidebar 相關 nav）

## Decisions

### 1. POI search provider: **OSM Nominatim** 免費
**為何**：免 API key + 免費 + 全球覆蓋 + 開源。Rate limit 1 req/sec 對 trip-planner 流量充足（配 Workers cache 放大）。
**備選**：Google Places（高品質但 $17/1000 req + API key exposure 風險）、Mapbox（$0.75/1000 req 便宜但需 token）。初期選免費，若 Nominatim 品質不足（例中文地名不佳）再升級。

### 2. Workers endpoint wrap Nominatim 呼叫
**為何**：(1) 加 cache 降 rate limit 壓力，(2) 統一回傳格式（trip-planner POI schema），(3) 隱藏 Nominatim URL 避免 client 直連暴露。
**備選**：Client 直呼 Nominatim — 違 rate limit + 格式不一致。

### 3. Nominatim response cache 1 小時
**為何**：地點資訊變動慢（e.g. 餐廳地址、經緯度）；1h cache 平衡新鮮度 + rate limit。
**實作**：Workers `caches.default` API key by query + category；可升級 KV for longer TTL。

### 4. Category filter UI：chip tabs (Pattern: pill tabs)
**為何**：Mindtrip 用 pill tabs（Image 5），符合 DESIGN.md 既有 pattern。
**實作**：景點 / 餐廳 / 飯店 / 購物 / 全部（default）5 個 chip，active 時填色。

### 5. 儲存池位置：Explore page 右側 column（桌機）/ 底部 section（手機）
**為何**：讓使用者看搜尋結果的同時可見儲存池狀態，不需切頁。
**備選**：獨立 `/explore/saved` tab — 多一步，拒絕。

### 6. 「加到某 trip 的 Ideas」flow: 點 `+` → 彈 trip picker modal
**為何**：使用者通常有多個 trips，需要選；picker modal 顯示 trip list + 選 Day（optional）。
**實作**：單純 React modal，Phase 1 Decision 6 的 drag flow 不在此 Phase（Phase 5 才做 drag）。

## Risks / Trade-offs

- **[Risk] Nominatim 中文地名品質不佳** → Mitigation: Phase 4 ship 後 user test；若不佳 Phase 6 升級 Google Places（保留 provider abstraction 切換不難）
- **[Risk] 1 req/sec rate limit 在 staging 測試期常觸發** → Mitigation: cache + dev mode 多用 mock data + User-Agent header 使 Nominatim 記 trip-planner 身分
- **[Risk] 儲存池 UI 在手機太佔空間** → Mitigation: 手機 default collapse 只顯示 count，點擊展開 full list
- **[Trade-off] 無桌機 map-first 跟 Mindtrip 差異大** → 差異化賣點；若 user 反彈 Phase 6 加桌機 map sheet split

## Migration Plan

1. **Week 7 Day 1-2**：Nominatim POC + `/api/poi-search` endpoint + Workers cache 實作
2. **Week 7 Day 3-4**：ExploreSearch UI + category filter
3. **Week 7 Day 5 - Week 8 Day 1**：ExploreSavedPool UI + 串接 `/api/saved-pois`
4. **Week 8 Day 2-3**：「加到 trip」trip picker modal + 呼叫 `/api/trip-ideas`
5. **Week 8 Day 4**：手機 layout（horizontal card scroll）
6. **Week 8 Day 5 - Week 9 Day 1**：E2E test + `/design-review`
7. **Week 9 Day 2**：`/tp-team` pipeline + staging
8. **Week 9 Day 3**：ship prod
9. **Rollback**：revert `/explore` 改回 placeholder（Phase 2 版本保留）

## Open Questions

- Explore 搜尋結果要不要 render 在地圖上？**建議 Phase 4 先不做**（純 list 即可，Phase 6 可加 map toggle）
- 儲存池可以分類嗎（e.g. 東京 / 首爾）？**建議先不分**（Mindtrip 有 collection 分組但 trip-planner 簡化）
- Nominatim 搜尋 bias 用什麼？**建議**：若使用者當前有 `selectedTripId`，bias 該 trip 的國家 / 主要城市；無則 global
