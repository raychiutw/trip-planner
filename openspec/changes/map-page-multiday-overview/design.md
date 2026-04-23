## Context

MapPage (`src/pages/MapPage.tsx`, 451 行) 是行程全螢幕地圖頁，URL 支援：
- `/trip/:tripId/map` → 預設 Day 1
- `/trip/:tripId/map?day=N` → 指定某天
- `/trip/:tripId/stop/:entryId/map` → 聚焦某 entry（自動判斷屬於哪天）

目前實作：Day tabs (snap-scroll) 橫向切換天、底下 entry cards 切 focus、OceanMap 以單日 `pins` render polyline（固定 accent 色、非 dayColor）。

TripMapRail (`src/components/trip/TripMapRail.tsx`, 210 行) 是桌機右側 sticky 地圖，已實作：
- 全行程 pins across all days
- 每天 pins by day grouping，polyline 用 `dayColor(N)` 區分（10 色循環，見 `src/lib/dayPalette.ts`）
- 點 pin 導 `/trip/:id/stop/:entryId`

Day palette: Tailwind -500 色 `sky / teal / amber / rose / violet / lime / orange / cyan / fuchsia / emerald`，定義於 `src/lib/dayPalette.ts`。

OceanMap (`src/components/trip/OceanMap.tsx`, 418 行) 是 Leaflet 共用元件，有 `mode='detail' | 'overview'`，overview 自動 cluster when >10 pins、每 segment 用 `useRoute(from, to)` 懶 fetch polyline，fallback Haversine 直線 + `approx: true`。

本 change 把 TripMapRail 的多日多色能力**延伸到 MapPage 全螢幕版**。

## Goals / Non-Goals

**Goals:**
- MapPage 支援「總覽」mode（`?day=all`）：顯示全行程 pins + 每天不同顏色 polyline
- MapPage 單日 mode polyline 顏色改用 `dayColor(N)`，與 TripMapRail 視覺對齊
- Day tabs 最左 prepend「總覽」選項（在 Day 01 前）
- 總覽 mode 下點任意 entry card → map flyTo（不切換選中的 tab）
- 手機與桌機皆可用（使用同一 MapPage）

**Non-Goals:**
- 不改 TripMapRail 本身 UX（只抽共用 helper）
- 不加新 URL pattern（僅沿用 `?day=all`）
- 不改 `/api/route` backend（使用既有 Mapbox proxy + IndexedDB cache）
- Overview mode 的 pin clustering 閾值不調整（沿用 OceanMap 現行 `pins.length > 10`）
- 不導入 server-side map tile 預載 / 其他效能優化

## Decisions

### Decision 1: URL 用 `?day=all` 而非新 route

**選擇**：延用 query param，`?day=all` 觸發 overview mode；`?day=N` 維持單日。

**為什麼**：
- 沿用既有 `useSearchParams` 解析路徑，不用新增 router 分支
- Deep link / 外部分享連結格式一致
- `<Link to="/trip/.../map?day=N">` 既有 chip 不用改

**替代**：`/trip/:id/map/overview` 新 route → 需改 `main.tsx` + `<Route>` + 兩個 component 路徑，收益低。

### Decision 2: Day tab prepend「總覽」（非 append）

**選擇**：在 Day 01 之前加「總覽」tab（最左），而非最右。

**為什麼**：
- 使用者進 MapPage 時 default 到 Day 1（左側 scroll 起點），「總覽」放左可直接看到
- 行程一覽 = overview 為上位概念，順序上先於具體某天
- 符合 Apple HIG「Progressive disclosure」— 先看全貌，再聚焦局部

**替代**：放最右 → 長行程（如 14 天）使用者要 scroll 到最右才切 overview，不直覺。

### Decision 3: OceanMap `<Segment>` 接 `dayNum` prop

**選擇**：`<Segment>` 新增 `dayNum: number` optional prop，用 `dayPolylineStyle(dayNum)` 覆蓋預設 `segmentStyle`。

**為什麼**：
- 最小侵入 — 既有 TripMapRail 呼叫 `<Segment dayNum={n}>` 可沿用
- MapPage 單日模式傳 `dayNum={currentDay}`、overview 每個 day's segments 傳對應 `dayNum={n}`
- 保留 `isActive` 高亮邏輯（selected entry 的前後 segment 較粗）

**替代**：傳 `colorOverride: string` → 靈活但 caller 要自己算色；直接用 `dayPolylineStyle(N)` 讓 style 集中於 palette helper 更好維護。

### Decision 4: pinsByDay 結構沿用 TripMapRail

**選擇**：MapPage overview mode 用 `Map<number, MapPin[]>`（dayNum → pins），與 TripMapRail `pinsByDay` prop 相同。

**為什麼**：
- TripMapRail 已有 `extractPinsFromDay` + 聚合 logic，可抽 util
- OceanMap 新增 `pinsByDay?` prop，若有就用多天多色 polyline，否則用 flat `pins`（單日模式）

**替代**：每個 pin 自帶 `dayNum` → 改動 MapPin type、多處型別要改；不如用 Map 集中。

### Decision 5: Overview mode flyTo 不切 tab

**選擇**：總覽模式下點任意 entry card，map flyTo 該 entry 的座標，但「總覽」tab 保持選中（不自動切到該 entry 所屬 day tab）。

**為什麼**：
- 使用者 intent：「我想在地圖上看這個點」，不是「我要進入單日模式」
- 避免誤切回單日後失去其他天 pin 可見性

**替代**：點 entry 切到該 day tab → 打亂使用者瀏覽 flow，反直覺。

### Decision 6: 單日模式 polyline 顏色用 dayColor(N) (breaking visual)

**選擇**：MapPage 單日 mode 的 polyline 顏色從固定 accent 改為 `dayColor(N)`。Day 1 = sky-500、Day 2 = teal-500、…

**為什麼**：
- 和 TripMapRail、overview mode 視覺完全對齊（同一個 Day 在任何入口看到的顏色都一樣）
- Accent 色在 UI chrome（tab 選中、按鈕等）保留原狀
- 符合 CLAUDE.md「UI chrome 嚴守 Ocean 單一 accent；Day palette 用於地圖 polyline」原則

**風險**：使用者可能習慣固定 accent 色 — 但 Day palette 已是專案共識（see CLAUDE.md、DESIGN.md Data Visualization 例外）。

### Decision 7: `extractPinsFromAllDays(days)` 抽 util

**選擇**：把「從全行程 days 提取 MapPin 陣列 + pinsByDay Map」抽為 `src/hooks/useMapData.ts` 的 export helper。

**為什麼**：
- TripMapRail 和 MapPage 共用，避免兩處重複
- TDD 時可獨立測 helper

**替代**：每個 caller 自己 loop → 重複、測試難。

## Risks / Trade-offs

- **[Risk] Mapbox route fetch 風暴**：Overview mode 首次載入需 fetch 全行程 N-1 segments（HuiYun 7 天約 50 segments，每 segment 一個 `/api/route` call） → Mitigation: `useRoute` 有 IndexedDB LRU cache (100 entries)，首次後再訪 free；且 Segment component 是 lazy render（只 render 進入 map viewport 的），Leaflet 會先 fitBounds 再觸發 route fetch
- **[Risk] 首次 Overview fetch time**：7 天 × 平均 7 segments ≈ 50 fetch, 4G 可能 3-5s 顯示全路線 → Mitigation: 可後續加「先 render 直線、async 補 real route」（本 PR 不做）
- **[Risk] Leaflet 渲染效能**：50+ polylines + pins 在手機 4G/3G 設備可能卡 → Mitigation: OceanMap 已有 auto-cluster (>10 pins)；polyline 不特別優化（既有 TripMapRail 桌機有 50+ 實績無問題）
- **[Risk] Day palette 10 色循環**：14 天以上行程 Day 11+ 會重複 sky-500（Day 1 同色）→ Mitigation: 實務上沖繩/韓國單趟行程通常 5-10 天；超過 10 天色彩循環是 Data Viz 慣例（acceptable）
- **[Trade-off] Polyline 顏色從固定 accent 改 dayColor**：視覺上稍微更繽紛，但與 TripMapRail 對齊；符合既有 palette 規範
- **[Trade-off] Overview mode flyTo 不切 tab**：違反「點哪切哪」直覺，但保留多天可見性；可用 **hover 狀態**彌補（未來 polish）

## Open Questions

- Overview mode 要不要顯示**日期標籤**在 polyline 旁？（類似 "Day 2" 浮標）→ 建議**不做**，pin 本身已有 index 編號，顏色 + 編號足夠識別
- Single day mode 切到 overview 時，scroll 位置要不要重置？→ 建議**重置**到 tab 最左（overview 選中狀態）
- 「總覽」字串 i18n？→ 本專案目前僅繁中，直接寫死；未來有 i18n 框架再抽
