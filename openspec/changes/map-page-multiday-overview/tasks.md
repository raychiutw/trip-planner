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

- [ ] 3.1 [CODE] `src/components/trip/OceanMap.tsx`：`<Segment>` 新增 `dayNum?: number` prop；`segmentStyle(isActive, approx, dayNum?)` 依 dayNum 改用 `dayPolylineStyle(dayNum)` 覆寫預設
- [ ] 3.2 [CODE] `OceanMap` props 新增 `pinsByDay?: Map<number, MapPin[]>`；render 時若有 `pinsByDay`，為每個 (dayNum, pinsInDay) group 生成 `<Segment dayNum={dayNum}>` 序列；若無則沿用 flat pins
- [ ] 3.3 執行 `npm run test`，1.3/1.4 轉綠

## 4. MapPage overview mode（TDD 綠階段 — page）

- [ ] 4.1 [CODE] `src/pages/MapPage.tsx`：解析 `?day` query，接受 `'all' | string(N)`；state `activeTab: 'overview' | number`
- [ ] 4.2 [CODE] day tabs render：prepend 「總覽」tab 於 Day 01 tab 之前；active state 依 `activeTab` 判定
- [ ] 4.3 [CODE] pins / OceanMap props 分支：
  - `activeTab === 'overview'`：`pinsByDay = extractPinsFromAllDays(days).pinsByDay`、傳 `pinsByDay`
  - `activeTab === N`：pins = 該天 pins、傳 `dayNum={N}`
- [ ] 4.4 [CODE] entry cards 顯示邏輯：overview mode 顯示所有 days 的 entry cards（水平 scroll group by day，或 flat 附 day prefix，視 UX 選擇）；single day mode 沿用既有只顯示該天
- [ ] 4.5 [CODE] flyTo 行為：overview mode 點 card 只 flyTo 不切 tab；single day 維持既有
- [ ] 4.6 執行 `npm run test`，1.1/1.2/1.5 轉綠

## 5. TripMapRail 抽共用 helper（視需要）

- [ ] 5.1 [CODE] 若 `extractPinsFromAllDays` 與 TripMapRail 既有邏輯可統一，refactor TripMapRail 改用 helper（避免重複）；否則 skip
- [ ] 5.2 執行 `npm run test`，TripMapRail 既有測試無 regression

## 6. Spec 驗證

- [ ] 6.1 [SPEC] `openspec validate map-page-multiday-overview` 驗證結構
- [ ] 6.2 [SPEC] 確認 `specs/map-page-overview/spec.md` 已在 change 目錄

## 7. 完整驗證

- [ ] 7.1 `npm run typecheck` 無錯
- [ ] 7.2 `npm run test` 全綠
- [ ] 7.3 `npm run build` 成功
- [ ] 7.4 `npm run dev` 本機啟動 → 驗證：
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
