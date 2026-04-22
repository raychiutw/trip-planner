# Tasks

**標記說明**
- `[CODE]` 進 git PR，React / TypeScript / test 程式碼
- `[SKILL]` 進 git PR，`.claude/skills/` markdown
- `[SPEC]` 進 git PR，`openspec/` 文件
- `[DATA]` 走 D1 API，不進 PR，列為驗收項
- `[PIPE]` gstack Sprint Pipeline 階段動作

**修訂紀錄**：apply 階段發現 tasks.md 假設 co-located `__tests__/` 結構錯誤（專案實際用 `tests/unit/` flat），且 R19 在 skill 層驗證、前端無 runtime validator 需求。2026-04-22 修訂移除 `src/lib/dailyFirstStop.ts` validator lib 與對應測試，保留 UI assertion test（改用 `tests/unit/` flat 路徑）。

## 1. 測試骨架（TDD 紅階段 — UI assertion 應 fail）

- [x] 1.1 [CODE] 新增 `tests/unit/day-section-no-hotel-driving-card.test.ts`：source-level 檢查不 import Hotel / DayDrivingStatsCard / calcDrivingStats / toHotelData、不 render <Hotel> 與 <DayDrivingStatsCard>、不宣告 dayDrivingStats（7 個 assertion）
- [x] 1.2 [CODE] 新增 `tests/unit/trip-page-no-trip-driving-stats.test.ts`：不 import calcTripDrivingStats、不宣告 tripDrivingStats、不傳 prop（3 個 assertion）
- [x] 1.3 [CODE] 新增 `tests/unit/trip-export-no-hotel.test.ts`：Markdown 無「🏨 住宿」/「🛍 住宿附近購物」/「退房：」；CSV 無「住宿名」「退房時間」欄、無「住宿」row 生成（6 個 assertion）
- [x] 1.4 執行 `npm run test`，確認 1.1-1.3 新增測試皆紅燈（16/16 assertion 全紅，符合 TDD 紅階段）

## 2. Skill 規則更新（`.claude/skills/`）

- [x] 2.1 [SKILL] `tp-quality-rules/SKILL.md`：新增 R19 完整條目（含 canonical spec 引用）、修訂 R2（早餐改由 hotel.breakfast 表達、午晚餐仍必填）、修訂 R8（同飯店早餐不重複 entry）
- [ ] 2.2 [SKILL] `tp-shared/references/modify-steps.md`：travel 語意擴充 — **defer**（現有「出發此地」語意已涵蓋 checkout 首站情境，R19 canonical 已在 tp-quality-rules 定義，邊際效益低；留給後續有需要時再補）
- [x] 2.3 [SKILL] `tp-create/SKILL.md`：step 4 新增 R19 首 entry 規則（Day 1 抵達點、Day N≥2 前日飯店 check-out）、午/晚餐必建 + 早餐彈性（飯店外吃才產 entry）
- [x] 2.4 [SKILL] `tp-rebuild/SKILL.md`：插入 step 5b R19 每日首 entry 檢查（Day 1 抵達、Day N check-out；缺則插入 leading entry、後續重算 travel）
- [ ] 2.5 [SKILL] `tp-check/SKILL.md`：驗證邏輯 — **defer**（tp-check 透過引用 tp-quality-rules R0-R19 自動涵蓋，紅綠燈閾值在 `references/severity-thresholds.md` 可留作後續擴充）
- [x] 2.6 [SKILL] `tp-edit/SKILL.md`：step 7 travel 重算段落加 R19 維持警示（index 0 不可被非 R19 entry 佔位；使用者要求把早餐移到 Day N 最前時，check-out 仍留 index 0、早餐置 index 1）

## 3. OpenSpec specs 驗證

- [x] 3.1 [SPEC] 跑 `openspec validate daily-first-stop-hotel-bridge`，回傳 `Change 'daily-first-stop-hotel-bridge' is valid`
- [x] 3.2 [SPEC] 確認 3 份 spec delta 已在 change 目錄（daily-first-stop ADDED、trip-quality-rules-source MODIFIED、transport-stats-always-open REMOVED）

## 4. UI 實作（TDD 綠階段 — React）

- [x] 4.1 [CODE] `src/components/trip/DaySection.tsx`：移除 Hotel + DayDrivingStatsCard + calcDrivingStats + toHotelData imports、移除 `const hotel` 宣告、移除 dayDrivingStats useMemo、移除兩個 render blocks
- [x] 4.2 [CODE] `src/pages/TripPage.tsx`：移除 calcTripDrivingStats import、tripDrivingStats useMemo、TripSheetContent prop 傳遞；附帶移除孤兒 `loadedDays` useMemo
- [x] 4.3 [CODE] `src/components/trip/OverflowMenu.tsx`：移除 `{ key: 'driving', ... }` 項目
- [x] 4.4 [CODE] `src/components/trip/TripSheetContent.tsx`：移除 TripDrivingStats/TripDrivingStatsCard import、SHEET_TITLES driving、props 型別、ACTION_MENU_GRID driving、case 'driving'、ai-group 的交通 div、useMemo deps
- [x] 4.5 [CODE] `src/lib/tripExport.ts`：移除 Markdown hotel section + hotel shopping + hotel row in CSV + 住宿名/退房時間 headers + timeline rows 的 hotel columns padding
- [x] 4.6 執行 `npm run test`，611/611 全綠（含 overflow-menu-divider 與 quick-panel 的既有測試同步更新至 R19 後的 11 items / divider indices）

## 5. 清理死碼（Refactor）

- [x] 5.1 [CODE] 刪除 `src/components/trip/Hotel.tsx`（toHotelData 拿掉後無人引用 HotelData type）
- [x] 5.2 [CODE] 刪除 `src/components/trip/DrivingStats.tsx`（UI 改動後無人 import）
- [x] 5.3 [CODE] 刪除 `src/lib/drivingStats.ts`（UI 改動後無人 import；無獨立 test 檔）
- [x] 5.4 清除 `src/lib/mapDay.ts` 的 `toHotelData` function + `HotelData` type import + orphan `RawHotel` / `RawParking` interfaces；`tests/unit/map-day.test.js` 移除 toHotelData 相關 3 個 it（buildLocation 行為改用 toTimelineEntry 測試）
- [ ] 5.5 執行 `/simplify` 檢視整體變更，套用建議（留給使用者後續 pipeline 觸發）

## 6. Data migration（走 D1 API）

- [ ] 6.1 [DATA] `/tp-rebuild okinawa-trip-2026-Ray` → `/tp-check okinawa-trip-2026-Ray` 全綠
- [ ] 6.2 [DATA] `/tp-rebuild okinawa-trip-2026-HuiYun` → `/tp-check` 全綠
- [ ] 6.3 [DATA] `/tp-rebuild okinawa-trip-2026-RayHus` → `/tp-check` 全綠
- [ ] 6.4 [DATA] `/tp-rebuild okinawa-trip-2026-AeronAn` → `/tp-check` 全綠
- [ ] 6.5 [DATA] `/tp-rebuild banqiao-trip-2026-Onion` → `/tp-check` 全綠
- [ ] 6.6 [DATA] `/tp-rebuild busan-trip-2026-CeliaDemyKathy` → `/tp-check` 全綠
- [ ] 6.7 [DATA] `/tp-rebuild kyoto-trip-2026-MimiChu` → `/tp-check` 全綠

## 7. 完整驗證（ship 前）

- [x] 7.1 `npm run typecheck` 無錯
- [x] 7.2 `npm run test`：608/608 全綠
- [x] 7.3 `npm run test:api`：179/179 全綠
- [x] 7.4 `npm run build` 成功（Vite + PWA 產出 dist/sw.js + workbox）
- [ ] 7.5 `npm run dev` 本機啟動手動檢查 — 留給 /qa 階段驗證

## 8. Pipeline（tp-team 七階段 — apply 後由使用者另行觸發）

- [ ] 8.1 [PIPE] `/tp-code-verify`（tsc + 命名規範 + CSS HIG + React best practices + 測試）
- [ ] 8.2 [PIPE] `/review`（staff engineer diff 審查 + adversarial）
- [ ] 8.3 [PIPE] `/cso --diff`（安全掃描）
- [ ] 8.4 [PIPE] `/qa`（UI 變更瀏覽器 QA + bug fix atomic commits）
- [ ] 8.5 [PIPE] `/ship` 建 PR（含 VERSION bump + CHANGELOG）
- [ ] 8.6 [PIPE] `/land-and-deploy` merge + 部署
- [ ] 8.7 [PIPE] `/canary <production-url>` 監控部署
- [ ] 8.8 [PIPE] PR merge 後執行 `/opsx:archive daily-first-stop-hotel-bridge`
