## Why

目前 MapPage（全地圖頁 `/trip/:tripId/map?day=N`）只支援**單日模式**，polyline 以固定 accent 色顯示；桌機 TripMapRail（sticky map）已支援**多天多色 polyline + 全行程 pins**，使用者切換 page 時會看到「地圖行為不一致」。

使用者反映希望：
1. MapPage 能「總覽」全行程所有天的路線
2. 單日模式 polyline 顏色也按 day palette 區分（和 TripMapRail 對齊）

把 TripMapRail 的多日多色功能**延伸到 full page MapPage**，讓使用者在「單日聚焦」和「全行程總覽」之間切換，且兩個入口（右側 sticky rail、full page map）視覺語言一致。

## What Changes

- **MapPage 新增「總覽」mode**
  - Day tabs 最左邊 prepend 一個「總覽」tab（在 Day 01 之前）
  - URL 支援 `?day=all`；預設（無 `?day`）或 `?day=N` 維持既有行為
  - 「總覽」選中時：顯示所有 days 的 pins（從所有 timeline entries 提取，含 hotel）+ 每日 polyline 用對應 `dayColor(N)` 區分
  - 「Day N」選中時：顯示當日 pins + 當日 polyline，polyline 顏色改用 `dayColor(N)`（目前固定 accent）
- **OceanMap `<Segment>` 支援 `dayColor` prop**：原本 hardcoded `var(--color-accent)` / `#94A3B8`，擴充為可接 dayColor(N) override；`dayPolylineStyle(N)` 作為樣式來源
- **MapPage pins 抽象化**
  - Overview mode：`pinsByDay: Map<number, MapPin[]>` + flat pins 陣列（同 TripMapRail 格式）
  - Single day mode：既有邏輯維持
- **點 entry card 地圖置中（flyTo）**
  - 單日模式：現有行為（flyTo(activeEntry)）保留
  - 總覽模式：點任意 day 的 entry card，map flyTo 該 entry，**不切換選中的 day**（使用者可繼續探索）
- **TripPage「看地圖 chip」** 已連結 `/trip/:id/map?day=N`，保持不變（驗證 deep link 正確）
- **連動 TripMapRail 和 MapPage overview 視覺一致**：同一趟行程在兩個入口看到的多日 polyline 顏色必須一致

## Capabilities

### New Capabilities

- `map-page-overview`: MapPage 全行程總覽 mode — day tab 最左「總覽」選項、overview URL、全行程 pinsByDay + 多色 polyline、overview↔single day 切換行為、flyTo 行為（含 overview 下的 entry 點擊）

### Modified Capabilities

- `trip-map-rail`: 共用 dayColor / dayPolylineStyle 邏輯擴展給 MapPage；TripMapRail 現有行為不變，但抽出 per-day polyline 樣式的 helper（使 MapPage 能重用）
- `day-palette`: 確認 `dayColor(N)` / `dayPolylineStyle(N)` 對 MapPage 單日和 overview 同樣適用；若現有 spec 已涵蓋可省略 delta

## Impact

**React UI**（進 PR）：
- `src/pages/MapPage.tsx` — 加 `day=all` 解析、overview mode、Day tab prepend「總覽」、polyline 顏色 prop、overview flyTo
- `src/components/trip/OceanMap.tsx` — `Segment` / `segmentStyle` 接受 `dayNum` 或 `colorOverride` prop，依 `dayPolylineStyle(N)` 上色；`<OceanMap>` 接受 `pinsByDay` 用於 overview polyline grouping
- `src/components/trip/TripMapRail.tsx` — 抽共用 helper 或直接沿用（視 refactor 需要）
- `src/lib/dayPalette.ts` — 確認 export 完整（`dayColor(N)` / `dayPolylineStyle(N)`）
- `src/hooks/useMapData.ts` — export `extractPinsFromAllDays(days)` 用於 overview（或沿用 TripMapRail 現有 hook）

**測試**（進 PR）：
- 新增 `tests/unit/map-page-overview.test.tsx`：
  - 「總覽」tab 存在且 prepend 於 Day 01 前
  - `?day=all` 觸發 overview mode
  - 單日模式 polyline 顏色對應 dayColor(N)
  - overview mode pin count = 所有 days pin 總和
- 更新 `tests/unit/map-page-*` 既有測試（若有 break）

**OpenSpec specs**（進 PR）：
- 新增 `specs/map-page-overview/spec.md`
- 修改 `specs/trip-map-rail.md`（若需要 shared helper 標註）
- 修改 `specs/day-palette.md`（若 dayPolylineStyle 簽名擴充）

**相依 / 風險**：
- **Mapbox route quota**：overview mode fetch 所有 day 的所有 segments（Ray 5 天約 20+ segments，HuiYun 7 天約 50+）— 首次載入會觸發多次 `/api/route`，但 `useRoute` 有 IndexedDB cache，後續 navigation 不重複 fetch
- **Viewport**：overview mode 的 `fitBounds` 要涵蓋所有 pins（非單日），目前 `useLeafletMap.fitBounds` 已支援
- **URL hash / SSR**：`?day=all` 與 deep link / service worker pre-cache 的相容性（Cloudflare Pages SW 對 `?day=N` 應該透明）

**不在 scope**：
- 手機版 MapPage 已由 `MobileBottomNav` route 處理（`/trip/:id/map`），overview mode 對手機同樣可用但 UI 不特別優化
- TripMapRail 本身行為不變（僅抽共用 helper）
