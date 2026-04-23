# Tasks

**標記說明**
- `[CODE]` 進 git PR，React / TypeScript / test
- `[SPEC]` 進 git PR，openspec 文件
- `[PIPE]` gstack Sprint Pipeline 階段動作

## 1. 測試骨架（TDD 紅階段 — 全 fail）

- [x] 1.1 [CODE] `tests/unit/map-page-overview-url.test.tsx`：source-level 驗 ?day=all parse、activeTab 型別、set('day', 'all')（3 assertion）
- [x] 1.2 [CODE] `tests/unit/map-page-overview-tab.test.tsx`：source-level 驗「總覽」字串存在 + prepend 於 dayTabs.map 前（2 assertion）
- [x] 1.3 [CODE] `tests/unit/map-page-polyline-color.test.tsx`：source-level 驗 MapPage import dayPalette、傳 dayNum/pinsByDay 給 OceanMap（2 assertion）
- [x] 1.4 [CODE] `tests/unit/ocean-map-pinsByDay.test.tsx`：source-level 驗 OceanMapProps 含 pinsByDay、SegmentProps 含 dayNum、呼叫 dayPolylineStyle、import dayPalette（4 assertion）
- [x] 1.5 [CODE] `tests/unit/map-page-overview-flyto.test.tsx`：source-level 驗 extractPinsFromAllDays 使用、activeTab === 'overview' 分支存在（2 assertion）
- [x] 1.6 執行測試：12/13 紅燈（1 個已經 pass 為 OceanMap 舊 import，符合 TDD 紅階段）

## 2. lib / hook 層（TDD 綠階段 — data）

- [x] 2.1 [CODE] `src/hooks/useMapData.ts`：新增 `extractPinsFromAllDays(allDays)` + `ExtractAllDaysResult` interface；input 為 `Record<number, Day>`；回傳 `{ pins, pinsByDay: Map, missingCount }`
- [x] 2.2 [CODE] `src/lib/dayPalette.ts`：已有 `dayColor(N)` 和 `dayPolylineStyle(N)` export，無需修改
- [x] 2.3 新增 `tests/unit/extract-pins-all-days.test.ts` 5 assertion 全綠（null input、多天 grouping、sort、missingCount、空 day）

## 3. OceanMap 擴充（TDD 綠階段 — component）

- [x] 3.1 [CODE] `OceanMap.tsx`：`<Segment>` 加 `dayNum?: number` prop；`segmentStyle(isActive, approx, dayNum?)` 依 dayNum 用 `dayPolylineStyle(dayNum)` — 色 + dashArray（奇實/偶虛 color-blind aid）；approx fallback 優先覆蓋 dashArray
- [x] 3.2 [CODE] `OceanMap` props 加 `pinsByDay?: Map<number, MapPin[]>` + `dayNum?: number`；`segments` useMemo 分支：pinsByDay → per-day pair 並傳 dayNum（跨天不連線）；flat pins → 沿用既有邏輯 + 統一 dayNum
- [x] 3.3 ocean-map-pinsByDay 4/4 綠；map-page-polyline-color 1/3 綠（MapPage 尚未改，符合 TDD 漸進轉綠）

## 4. MapPage overview mode（TDD 綠階段 — page）

- [x] 4.1 [CODE] `initialTab: 'overview' | number` useMemo 解析 `?day=all`/`?day=N`/預設；`activeTab` state + `isOverview` helper
- [x] 4.2 [CODE] day tabs：prepend「總覽」tab（aria-pressed=isOverview、顯示「{N} 天」）；Day tab active 時 borderBottom + eyebrow 用 `dayColor(N)` 著色
- [x] 4.3 [CODE] pins 三分支：overview → `extractPinsFromAllDays(allDays)`；single day → `extractPinsFromDay(currentDay)`；OceanMap 傳 `pinsByDay={isOverview ? ... : undefined}` 和 `dayNum={isOverview ? undefined : (activeTab as number)}`
- [x] 4.4 [CODE] entry cards：overview 顯示全行程 flat list + `D{N}` prefix 用 dayColor 著色；single day 沿用；empty state 文案分支
- [x] 4.5 [CODE] flyTo：overview mode 點 card 只 setActiveEntryId（OceanMap 自 focusId 觸發 flyTo）不切 tab；既有邏輯 handleCardClick 不動（本來就不切 tab，只是之前 effect 同步 activeTab 現在是 activeTab）
- [x] 4.6 既有 map-page-day-query test 更新 initialDayNum→initialTab、activeDayNum→activeTab；628/628 全綠

## 5. TripMapRail 抽共用 helper（視需要）

- [ ] 5.1 [CODE] SKIP — TripMapRail 是獨立 Leaflet 實作（直接 `L.polyline` 畫直線），不走 OceanMap Segment（useRoute 曲線）。兩者渲染管線不同、無共用 helper 可抽。`extractPinsFromAllDays` 已 export，TripPage 若想重構改用（目前自己 extract）可另開 PR
- [x] 5.2 既有 TripMapRail tests 無 regression（TripMapRail 程式碼未動）

## 6. Spec 驗證

- [x] 6.1 [SPEC] `openspec validate`：Change 'map-page-multiday-overview' is valid
- [x] 6.2 [SPEC] `specs/map-page-overview/spec.md` 確認在 change 目錄

## 7. 完整驗證

- [x] 7.1 `npm run typecheck` 無錯
- [x] 7.2 `npm run test`：628/628 全綠
- [x] 7.3 `npm run test:api`：179/179 全綠
- [x] 7.4 `npm run build` 成功（Vite + PWA 37 entries）
- [ ] 7.5 `npm run dev` 本機啟動手動驗證 — 留給使用者在 /qa 階段驗：
  - `/trip/okinawa-trip-2026-Ray/map` → Day 1 sky-500 polyline
  - `/trip/okinawa-trip-2026-Ray/map?day=3` → Day 3 amber-500
  - `/trip/okinawa-trip-2026-Ray/map?day=all` → 所有天多色 polyline
  - 點 entry card → map flyTo
  - 桌機 TripMapRail 顏色與 MapPage overview 視覺一致

## 8. Pipeline（tp-team 七階段 — apply 後由使用者另行觸發）

- [ ] 8.1 [PIPE] `/tp-code-verify`
- [ ] 8.2 [PIPE] `/review`
- [ ] 8.3 [PIPE] `/cso --diff`
- [ ] 8.4 [PIPE] `/qa`（multi-day overview 可見性）
- [ ] 8.5 [PIPE] `/ship`
- [ ] 8.6 [PIPE] `/land-and-deploy`
- [ ] 8.7 [PIPE] `/canary <production-url>`
- [ ] 8.8 [PIPE] PR merge 後 `/opsx:archive map-page-multiday-overview`
