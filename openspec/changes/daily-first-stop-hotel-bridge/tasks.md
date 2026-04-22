# Tasks

**標記說明**
- `[CODE]` 進 git PR，React / TypeScript / test 程式碼
- `[SKILL]` 進 git PR，`.claude/skills/` markdown
- `[SPEC]` 進 git PR，`openspec/` 文件
- `[DATA]` 走 D1 API，不進 PR，列為驗收項
- `[PIPE]` gstack Sprint Pipeline 階段動作

**修訂紀錄**：apply 階段發現 tasks.md 假設 co-located `__tests__/` 結構錯誤（專案實際用 `tests/unit/` flat），且 R19 在 skill 層驗證、前端無 runtime validator 需求。2026-04-22 修訂移除 `src/lib/dailyFirstStop.ts` validator lib 與對應測試，保留 UI assertion test（改用 `tests/unit/` flat 路徑）。

## 1. 測試骨架（TDD 紅階段 — UI assertion 應 fail）

- [ ] 1.1 [CODE] 新增 `tests/unit/day-section-no-hotel-driving-card.test.tsx`：assert DOM 不含 `<Hotel>` 與 `<DayDrivingStatsCard>` 元件（目前為紅燈）
- [ ] 1.2 [CODE] 新增 `tests/unit/trip-page-no-trip-driving-stats.test.tsx`：assert 不計算 / 不傳遞 `tripDrivingStats`（目前為紅燈）
- [ ] 1.3 [CODE] 新增 `tests/unit/trip-export-no-hotel.test.ts`：assert 匯出不含「🏨 住宿」段落、CSV 不含「住宿名 / 退房時間」欄（目前為紅燈）
- [ ] 1.4 執行 `npm run test`，確認 1.1-1.3 新增測試皆紅燈（符合 TDD 紅階段）

## 2. Skill 規則更新（`.claude/skills/`）

- [ ] 2.1 [SKILL] `tp-quality-rules/SKILL.md`：新增 R19 條目（引用 capability `daily-first-stop`）、修訂 R2（早餐不強制）、修訂 R8（同飯店早餐不重複 entry）
- [ ] 2.2 [SKILL] `tp-shared/references/modify-steps.md`：travel 語意章節擴充 — 涵蓋 checkout 首站（Day N≥2 首 entry 的 travel 指向「從飯店出發至次一站」）
- [ ] 2.3 [SKILL] `tp-create/SKILL.md`：生成邏輯加入 — Day 1 首 entry 抵達點（詢問使用者抵達地點與時間）、Day N≥2 自動插入前日 hotel check-out entry（用 `hotel.checkout` 或預設 07:00）
- [ ] 2.4 [SKILL] `tp-rebuild/SKILL.md`：重整邏輯加入 — 檢查每日 timeline 首 entry 是否合 R19，不合則插入 leading entry 並重算 travel
- [ ] 2.5 [SKILL] `tp-check/SKILL.md`：驗證邏輯新增 R19 檢查（紅綠燈 report 包含 R19 項）
- [ ] 2.6 [SKILL] `tp-edit/SKILL.md`：編輯邏輯 — 插入/移除/移動 entry 時若動到 index 0，SHALL 保持 R19 語意（不允許把非 R19 entry 插入 index 0）

## 3. OpenSpec specs 驗證

- [ ] 3.1 [SPEC] 跑 `openspec validate daily-first-stop-hotel-bridge` 驗證 proposal/design/specs/tasks 結構合規
- [ ] 3.2 [SPEC] 確認 `specs/daily-first-stop/spec.md`、`specs/trip-quality-rules-source/spec.md`、`specs/transport-stats-always-open/spec.md` 三份已在 change 目錄

## 4. UI 實作（TDD 綠階段 — React）

- [ ] 4.1 [CODE] `src/components/trip/DaySection.tsx`：移除 `<Hotel hotel={...}>` 區塊（含外層 `ocean-side-card`）、移除 `<DayDrivingStatsCard>` 區塊、移除 `useMemo(dayDrivingStats)`、移除 `toHotelData` import（若無其他用途）
- [ ] 4.2 [CODE] `src/pages/TripPage.tsx`：移除 `calcTripDrivingStats` import、移除 `tripDrivingStats` useMemo、移除傳給 DaySection 的 `tripDrivingStats` prop
- [ ] 4.3 [CODE] `src/components/trip/OverflowMenu.tsx`：移除 `{ key: 'driving', icon: 'car', label: '交通統計', ... }` 項目
- [ ] 4.4 [CODE] `src/components/trip/TripSheetContent.tsx`：移除 `driving: '交通統計'` 映射、移除對應 case / sheet content
- [ ] 4.5 [CODE] `src/lib/tripExport.ts`：移除 Markdown 匯出的「🏨 住宿」段落（line 128）與「住宿附近購物」段落（line 141）；移除 CSV header 的「住宿名 / 退房時間」與對應資料欄（line 221, 236）
- [ ] 4.6 執行 `npm run test`，確認 1.1/1.2/1.3 轉綠

## 5. 清理死碼（Refactor）

- [ ] 5.1 [CODE] `grep -r "from.*Hotel"` 確認無其他 import 後刪除 `src/components/trip/Hotel.tsx`
- [ ] 5.2 [CODE] `grep -r "DrivingStats"` 確認無其他 import 後刪除 `src/components/trip/DrivingStats.tsx`
- [ ] 5.3 [CODE] `grep -r "drivingStats"` 確認無其他 import 後刪除 `src/lib/drivingStats.ts` 及其 test
- [ ] 5.4 檢查並刪除 `src/types/` 中無人引用的 `HotelData` / `DayDrivingStats` / `TripDrivingStats` 型別
- [ ] 5.5 執行 `/simplify` 檢視整體變更，套用建議

## 6. Data migration（走 D1 API）

- [ ] 6.1 [DATA] `/tp-rebuild okinawa-trip-2026-Ray` → `/tp-check okinawa-trip-2026-Ray` 全綠
- [ ] 6.2 [DATA] `/tp-rebuild okinawa-trip-2026-HuiYun` → `/tp-check` 全綠
- [ ] 6.3 [DATA] `/tp-rebuild okinawa-trip-2026-RayHus` → `/tp-check` 全綠
- [ ] 6.4 [DATA] `/tp-rebuild okinawa-trip-2026-AeronAn` → `/tp-check` 全綠
- [ ] 6.5 [DATA] `/tp-rebuild banqiao-trip-2026-Onion` → `/tp-check` 全綠
- [ ] 6.6 [DATA] `/tp-rebuild busan-trip-2026-CeliaDemyKathy` → `/tp-check` 全綠
- [ ] 6.7 [DATA] `/tp-rebuild kyoto-trip-2026-MimiChu` → `/tp-check` 全綠

## 7. 完整驗證（ship 前）

- [ ] 7.1 `npm run typecheck` 無錯
- [ ] 7.2 `npm run test` 全綠
- [ ] 7.3 `npm run test:api` 全綠（若有 API 變更）
- [ ] 7.4 `npm run build` 成功
- [ ] 7.5 `npm run dev` 本機啟動，手動檢查 7 個行程首頁渲染（Day 1 首 entry 為抵達點、Day N 首 entry 為前日飯店 check-out）

## 8. Pipeline（tp-team 七階段 — apply 後由使用者另行觸發）

- [ ] 8.1 [PIPE] `/tp-code-verify`（tsc + 命名規範 + CSS HIG + React best practices + 測試）
- [ ] 8.2 [PIPE] `/review`（staff engineer diff 審查 + adversarial）
- [ ] 8.3 [PIPE] `/cso --diff`（安全掃描）
- [ ] 8.4 [PIPE] `/qa`（UI 變更瀏覽器 QA + bug fix atomic commits）
- [ ] 8.5 [PIPE] `/ship` 建 PR（含 VERSION bump + CHANGELOG）
- [ ] 8.6 [PIPE] `/land-and-deploy` merge + 部署
- [ ] 8.7 [PIPE] `/canary <production-url>` 監控部署
- [ ] 8.8 [PIPE] PR merge 後執行 `/opsx:archive daily-first-stop-hotel-bridge`
