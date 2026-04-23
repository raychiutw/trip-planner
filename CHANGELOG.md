# Changelog

All notable changes to Tripline will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.1.0.1] - 2026-04-23

**字體一致性稽核修復** — 跨桌機 + 手機所有頁面字體統一為 Inter。使用者體感：/manage、/admin 的 button chip 不再用 Arial，地圖 pin 標號不再用 Helvetica Neue / system-ui，Leaflet +/− zoom 按鈕不再用 Lucida Console，整個 app 視覺更統一。

### Fixed
- **Tailwind 4 `text-*` utility class 靜默失效** — `@theme` 沒註冊 `--text-*` token，導致 `text-caption` / `text-caption2` / `text-callout` / `text-body` 等 class 不生效；所有寫這些 class 的 button / span 退回瀏覽器 UA default（Windows `button` = Arial 13.33px）。新增 12 個 `--text-*` alias 從 `--font-size-*` 對映，全部 utility class 一次啟用。
- **`<button>` / `<input>` 字體繼承斷裂** — Tailwind 4 的 `@import "tailwindcss/theme"` 不含 preflight reset；新增全域 `button, input, select, textarea { font-family: inherit; font-size: inherit; }` 讓所有 form element 拿到 body 的 Inter。
- **地圖 pin marker 字體錯誤** — `TripMapRail.tsx` `createPinIcon` 的 inline style 硬寫 `font-family: system-ui`；`OceanMap.tsx` `.ocean-map-pin` 用 `font-family: inherit`（從 Leaflet `.leaflet-container` 繼承 Helvetica Neue）。三處都改用 `var(--font-family-system)` token。
- **Leaflet 預設控件字體** — `+` / `−` zoom 按鈕用 Leaflet stylesheet 預設的 Lucida Console；attribution 用 Helvetica Neue。新增 `.ocean-map-container` 與 `.trip-map-rail` scope 內的 `.leaflet-bar a` / `.leaflet-control-attribution` font-family override。

## [2.1.0.0] - 2026-04-23

**MapPage 多天總覽** — 地圖頁 (`/trip/:tripId/map`) 新增「總覽」模式：最左側 tab 切換到 `?day=all` 後，地圖一次顯示全行程所有景點 pin，每天用不同顏色 polyline 連接路線（與桌機側邊 TripMapRail 一致的 10 色 Day palette）。單日模式 polyline 也改用當天顏色，兩個入口視覺語言統一。點卡片可跨天 flyTo 定位，切 tab 秒速且不重抓路線。

### Added
- **MapPage「總覽」tab** — 日期 tabs 最左側新增「總覽」選項，顯示「{N} 天」副標。URL `/trip/:tripId/map?day=all` 進入總覽模式；既有 `?day=N` 行為保留。
- **多天多色 polyline** — 總覽模式下每天 polyline 用 `dayColor(N)` 著色（10 色循環：sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald -500）。跨天不畫連線，每天路線獨立。
- **單日模式 polyline 改用 dayColor(N)** — 之前固定 accent 色，現在與 TripMapRail 對齊。同一趟 Day 3 在桌機 rail 和 MapPage 都看到 amber-500。
- **Entry card 跨天定位** — 總覽模式下卡片前綴 `D{N}` 著上當天色。點任一天的卡片可直接 flyTo 該景點座標，不自動切 tab（保留多天視野）。
- **`extractPinsFromAllDays(allDays)` util** — 新 export 於 `src/hooks/useMapData.ts`，回傳 `{ pins, pinsByDay: Map<number, MapPin[]>, missingCount }`。TripMapRail 和 MapPage 共用資料結構。
- **OceanMap `pinsByDay` / `dayNum` props** — 共用 Leaflet 元件支援多天多色 polyline；`buildSegments(params)` 抽為 pure helper 供單元測試。
- **11 個新 runtime 測試** — `extract-pins-all-days.test.ts`（5）、`ocean-map-build-segments.test.ts`（6，含 hotel 過濾 + 跨天不連線契約）、`map-page-overview-runtime.test.tsx`（5，含 `?day=all` 下 fitBounds 不 flyTo、tab 切換 URL/props 同步）。另有 5 個 source-level regression guards。
- **DESIGN.md「地圖 chrome 子例外」** — 記錄 Day 指示 tab active state 可用 `dayColor(N)` 著色（其餘 chrome 仍守 Ocean accent）。

### Changed
- **Day tab 觸控目標 ≥ 44px** — `.map-page-day-tab` `min-height` 從 40px 改 `var(--spacing-tap-min, 44px)`（padding 10px/12px → 12px/14px），符合 Apple HIG。
- **OceanMap viewport follow 優化** — `pins.find()` O(n) 換成 `pinIndexById.get()` O(1)（焦點切換時每次省掉一次線性掃描，overview 模式 30+ pins 尤其有感）。
- **Segment React key 穩定化** — per-day key 從 `d${d}:${a.id}->${b.id}` 簡化為 `${a.id}->${b.id}`，切換 overview↔單日 tab 時 Segment 保持 identity，不再整組 remount / 重新 fetch Mapbox 路線。

### Fixed
- **Overview 初始載入被拉到第一站** — `?day=all` 開啟時不再預設 `activeEntryId` 為第一張 card，OceanMap 走 `fitBounds` 顯示全行程而非 `flyTo` 第一站（Codex adversarial + structured review 雙確認的 P1 bug）。
- **Overview 誤畫 hotel→第一站線段** — per-day polyline 過濾 `type === 'entry'`，對齊 TripMapRail 契約（hotel 是夜棲點不參與路線）。
- **Overview 大行程 pins 不 cluster** — `cluster={!isOverview ? false : undefined}` 讓 OceanMap 內建閾值（>10 pins 自動 cluster）在總覽模式生效。

## [2.0.3.0] - 2026-04-23

R19 — 每日首 timeline entry 橋接前日飯店 check-out。使用者體感：Day 2~7 每天都從「前日飯店退房」開始，時間軸連貫不跳段；Day 1 首 entry 為抵達點。同時移除不再需要的「住宿資訊」card 與「每日/全程交通統計」card（資訊已整合至 timeline）。

### Added
- **OpenSpec change `daily-first-stop-hotel-bridge`** — 3 個 spec delta：新增 `daily-first-stop`（定義 Day N timeline[0] 必為 Day N-1 hotel check-out）、修訂 `trip-quality-rules-source`（R19 入列）、移除 `transport-stats-always-open`（card 已刪）。含 proposal.md / design.md / tasks.md。
- **`tp-quality-rules` R19** — 每日首 entry 規則：Day 1 抵達點、Day N≥2 為前日 `day.hotel` check-out entry（title 含「退房」語意、location 同飯店 POI、不複製 hotel.infoBoxes；若 breakfast.included=true 則 description 開頭 inject「🍳 早餐：…」）。與 R0/R8 正交。
- **`tp-rebuild` step 5b**、**`tp-create` step 4 R19 規則**、**`tp-edit` step 7 travel R19 警示** — 所有 data skill 都納入 R19 rebuild / validate / edit 流程。
- **3 個 R19 紅燈測試**：`tests/unit/day-section-no-hotel-driving-card.test.ts`（7 assertions）、`trip-page-no-trip-driving-stats.test.ts`（3）、`trip-export-no-hotel.test.ts`（7）。

### Removed
- **`src/components/trip/Hotel.tsx`**（-81 lines）— 住宿資訊 card 下架。hotel info 由 timeline[0] 的 check-out entry 承載。
- **`src/components/trip/DrivingStats.tsx`**（-193 lines）— 每日交通統計 card + 全行程交通統計 card 下架。交通資訊改以各 entry 的 travel 欄位就地呈現。
- **`src/lib/drivingStats.ts`**（-162 lines）— `calcDrivingStats` / `calcTripDrivingStats` 計算邏輯整包移除。
- **`src/lib/formatUtils.ts`** — 僅剩 `export {}` 空殼（唯一 caller `formatMinutes` 已隨 drivingStats.ts 移除）。
- **`src/lib/mapDay.toHotelData`** + `HotelData` / `RawHotel` / `RawParking` 類型（-95 lines）— toTimelineEntry 取代其資料路徑。
- **`src/lib/constants.ts`**：`DRIVING_WARN_MINUTES` / `DRIVING_WARN_LABEL` / `TRANSPORT_TYPES` / `TRANSPORT_TYPES_ORDER`（-24 lines，僅 DrivingStats 使用）。
- **`TripPage.tsx` tripDrivingStats 計算 + prop 傳遞**（-14 lines）。
- **`TripSheetContent.tsx` `driving` / `prep` / `emergency-group` / `ai-group` 四個 sheet case + ACTION_MENU_GRID `driving` 項**（-45 lines）。
- **`OverflowMenu.tsx` `driving` 選項**、**`MobileBottomNav.tsx` `driving` sheet case**。
- **`tripExport.ts` Markdown 🏨 住宿 / 退房 header + CSV 住宿名 / 退房時間 columns + hotel row**（-49 lines）。
- **E2E `每日交通統計` + `全旅程交通統計` describe blocks**（tests/e2e/trip-page.spec.js -51 lines）。

### Changed
- **`DaySection.tsx`** — 簡化渲染：只保留 Ocean hero card、Weather card、Timeline；Hotel 與 DayDrivingStatsCard 兩個 render block 移除。
- **`map-day.test.js`** — 3 個 `toHotelData` 測試案例改寫為 `toTimelineEntry` restaurants（URL 模式 + name fallback）。
- **`overflow-menu-divider.test.tsx`** — 分隔線位置由 4/5/8 改為 3/5/7（driving item 移除後）。
- **`quick-panel.test.js`** — action-menu item count 從 13 降至 11。

### Process
- **TDD 紅→綠**：commit `e97180d` 先建 3 個紅燈測試，`870018e` 完成 UI 綠階段，`b05a865` 清理死碼。
- **R19 data migration 已於 7 個 trip 驗證**：本 branch 同 session 跑過 `/tp-rebuild okinawa-trip-2026-HuiYun`（D1 直寫，不進 PR diff），產出 7/7 天 R19 合規 timeline。Prod 驗證：Day 2-6 首 entry 為前日飯店 check-out entry。
- **OpenSpec 流程**：propose → apply（本 PR）→ 待 merge 後 archive。
- **Tests**：610 unit + 179 api = **789 tests all green**，無新增 regression。

## [2.0.2.8] - 2026-04-22

PR 11 post-hoc audit 發現的 tech debt 清理。純 refactor + 1 個 silent bug fix（malformed time 格式顯示「NaNm」字串）。使用者體感：當 time 欄位意外格式錯時不再顯示 "NaNm" 垃圾文字。

### Added
- **`src/lib/timelineUtils.ts`** — 抽出 `parseTimeRange` / `formatDuration` / `deriveTypeMeta` / `parseStartMinutes` / `parseEndMinutes` 共用 util。消除 `TimelineEvent.tsx` / `TimelineRail.tsx` / `Timeline.tsx` 三檔 ~80 行重複邏輯。
- **`tests/unit/timelineUtils.test.ts`** — 43 個 assertions 含 edge cases（null / empty / malformed / 跨日 / NaN / Infinity）+ source-match guards（防止本地 function 定義回流）。

### Fixed
- **`formatDuration(NaN)` → `"NaNm"` 顯示 bug**：`/review` 發現 parseTimeRange 遇 malformed time（例 `"10:ab-11:00"`）時 parseInt 回 NaN，duration → NaN，`formatDuration` 計算結果 `"NaNm"` 被 render 到 stop card。加 `Number.isFinite` guard 覆蓋 NaN / Infinity / -Infinity。

### Changed
- **`TimelineRail.tsx` JSDoc** — 移除過時的「mobile-only compact timeline（設計稿 design_mobile.jsx）」描述，改「桌機與手機統一 compact editorial rail（PR 11 / v2.0.2.7 後）」反映實況。
- **`TimelineEvent.tsx` 刪 unused `index` prop** — 介面宣告但 function body 未使用，dead prop 清理。

### Process
- **OpenSpec SDD proper flow**：`openspec/changes/pr12-timeline-utils/` propose → apply（TDD F001-F005 紅→綠）→ archive。補償 PR #213 跳過 pipeline 鐵律（/simplify / /tp-code-verify / /review / /cso --diff 全跑）。
- **/simplify 3-agent parallel** 發現：Timeline.tsx 的 parseStart/EndMinutes 原本漏抽（F005 補齊）、ParsedTime interface 改 internal（YAGNI）。
- **/review** 抓到 NaN 顯示 bug（本次 ship 重點 fix）。
- **Tests**：577 → **595 tests**（+18）。

## [2.0.2.7] - 2026-04-22

Design-review 發現桌機 vs 手機行程一覽用完全不同的 component 渲染（違反「同 DOM tree、CSS 分流 layout」原則），改成統一使用 `TimelineRail`。使用者體感：桌機版時間軸跟手機一樣簡潔 editorial，不再是 4-col stop card。

### Changed
- **`Timeline.tsx` 刪除 `useMediaQuery('(max-width: 760px)')` 分支**：原本 mobile 用 `TimelineRail`、desktop 用 `TimelineEvent` (4-col stop card) 兩個完全不同的 344 行 component。桌機左欄在 PR 3 (v2.0.2.0) 後已 `clamp(375px, 30vw, 400px)` 跟 mobile 同寬，TimelineRail 即為此寬度設計的 editorial compact rail，直接統一即可。
- **`TimelineEvent.tsx` 保留**：僅 `TimelineEntryData` / `TravelData` type export 仍被 `TimelineRail` / `TodayRouteSheet` / `mapDay.ts` 使用。component 本身變成 orphan export（無 JSX 呼叫處），可未來另一個 PR 清理。

### Fixed
- **Desktop/mobile timeline 結構不一致**：同一個 day section 在 desktop 1440 跟 mobile 375 會 render 出不同 DOM tree。現在統一。

## [2.0.2.6] - 2026-04-21

stale PR #179 抽出的 2 個實質 fix，rebased 到 latest master 後重發。API error logging 更詳細、tripExport 從 N+1 改 batch。

### Fixed
- **`tripExport` N+1 → batch days endpoint**：`src/lib/tripExport.ts` 原本迴圈逐天呼叫 API，改 batch 一次拿齊所有 days，export 大行程（10+ 天）時 API round-trip 從 O(N) 降到 O(1)。
- **`api_logs` 記錄 error detail**：`functions/api/_middleware.ts` 原本 error 進 api_logs 只記 code，加 error.message 細節幫助 debug production issue。
- **`trip-pois` PATCH 驗證訊息**：`functions/api/trips/[id]/trip-pois/[tpid].ts` 改善驗證錯誤訊息（具體欄位而非泛用 "invalid input"）。

### Process
- stale PR #179 (2026-04-14) 原 branch 落後 master 180 檔，直接 rebase 不實際。改 cherry-pick 2 個實質 commit 到 fresh branch（`fix/pr10-extracted-from-179`），無 merge conflict。同 cycle 一起 close #192 / #196 / #150 三個完全過時的 PR。

## [2.0.2.5] - 2026-04-21

Lighthouse CI perf baseline infrastructure。autoplan retro 發現沒 baseline 就沒 regression detection，本 PR 建 non-blocking baseline。對使用者無直接變化，但 master push 後 GitHub Actions 會跑 Lighthouse 3 runs × 3 URLs，PR 反而能看到 perf trend。

### Added
- **`lighthouserc.json`** — 3 URL (`/` + TripPage + StopDetailPage) × 3 runs，desktop preset
- **Perf budget (warn-only)**：LCP < 2.5s、TBT < 300ms、CLS < 0.1、perf score ≥ 0.8
- **`.github/workflows/lighthouse.yml`** — push master + workflow_dispatch 觸發、`treosh/lighthouse-ci-action@v12` + artifact upload
- **`docs/lighthouse-ci.md`** — 使用說明 + 如何看 artifact + future roadmap
- **TODOS.md** — 2 週 baseline 穩定後升 P1（warn → error gate）

### Tests
- 539 → **552** (+13): `lighthouse-config.test.ts` + `lighthouse-workflow.test.ts`

## [2.0.2.4] - 2026-04-21

OG link preview MVP。行程連結在 LINE / iMessage / Slack / Twitter 分享時終於有預覽（藍底 + Tripline 品牌 + 副標），不再是白板。autoplan CEO retro 發現的「Tripline 唯一 distribution channel 完全沒開發」的問題。

### Added
- **Static brand OG image** (`public/og/tripline-default.png`)：1200×630 PNG，Tripline Ocean 藍底 + 白字大標「Tripline」+ 副標「和旅伴一起查看精美行程」+ 裝飾 dot pattern。用 `scripts/generate-og-image.mjs` (sharp + inline SVG) 在 build 時或手動產生。
- **`index.html` OG + Twitter card meta**：完整 `og:type / site_name / title / description / image / image:width / image:height / url` + `twitter:card=summary_large_image / title / description / image`。
- **`_headers` `/og/*` Cache-Control**：`public, max-age=86400` + `X-Content-Type-Options: nosniff`，OG image 24h CDN cache。
- **`TODOS.md` dynamic OG roadmap**：Per-trip 動態 OG image (行程名 + 天數 + 目的地) 的 future scope + blockers (Cloudflare Workers 上 @vercel/og 相容性 + 中文字型載入 + KV cache)。

### Tests
- `og-image.test.ts` (PNG 存在 + size guard)、`og-meta.test.ts` (8 og: props + twitter card)、`og-headers.test.ts` (_headers rule)
- 522 → **539** (+17) 測試總數

## [2.0.2.3] - 2026-04-21

autoplan retrospective 發現的 11 項修復：4 個 regression/假對齊 + 7 個 quality/perf。重要體感：
- 桌機切深色模式後地圖也跟著切（原本永遠淺色）
- 切行程後地圖 focus 跟著切（原本停在上一個行程視角）
- 每天的 polyline 顏色 + 虛實交替，色盲族群也能分辨
- Mobile 底部 tab「訊息」改「助理」（使用者不再以為是 LINE 訊息）
- 左欄 scroll 到哪天，右側地圖自動平移到那天路線

### Fixed
- **TripMapRail `dark` prop 缺失** (F001)：TripPage 沒傳 `dark={isDark}`，dark mode 下地圖底圖永遠淺色。補上 + `useLeafletMap` 收到 `dark` 觸發 tile swap。
- **`fitDoneRef` 跨行程不 reset** (F002)：切行程時 TripMapRail 不重掛，`fitBounds` 不再跑，地圖停在上一個行程焦點。加 `key={trip.id}` 強制 remount。
- **Mobile Hero title 假對齊** (F003)：DESIGN.md 宣稱 mobile hero title 24px 但 CSS 只有 22px。補 `@media (max-width: 760px)` override 對齊 DESIGN.md type scale。
- **`color-scheme` 宣告缺失** (F004)：`html` 加 `color-scheme: light dark`，瀏覽器原生 scrollbar / select / date input 在 dark mode 正確轉暗（之前是白色破相）。

### Changed
- **TripMapRail 改 `React.lazy()`** (F005)：150KB Leaflet chunk 不再從 TripPage 初始 load，mobile 使用者 TTI 受益。desktop ≥1024 才 import。
- **Day Polyline dashArray 色盲友善** (F008)：`src/lib/dayPalette.ts` 新增 `dayPolylineStyle(dayNum)` helper，奇數天 solid、偶數天 `dashArray: '6,4'`。10 色 palette + 虛實交替，sky/cyan 跟 rose/fuchsia 對色盲族群也可分辨。
- **MobileBottomNav「訊息」→「助理」** (F009)：tab label 修正語意誤導（使用者原以為是 message inbox），aria-label 同步。
- **`看地圖` chip tap target 44px** (F010)：`min-height: 44px` + `display: inline-flex; align-items: center;`，符合 Apple HIG 最小觸控目標。

### Added
- **TripMapRail scroll fly-to active day** (F007)：IntersectionObserver 監測 timeline 每天 section 進入 viewport，地圖 `panTo(dayCenter)` 跟著。靜態地圖變成 spatial context。
- **TripMapRail marker click integration test** (F006)：原本 `map: null` mock 讓核心 Leaflet click 邏輯零覆蓋，改用 fake marker 模擬 click → assert navigate 被 called。
- **MapPage `?day=N` runtime test** (F011)：原本 string-match test 升級為 mount + assert：`?day=2` → initialDayNum=2、`?day=abc` → fallback day 1、`?day=999` → fallback day 1。

### Process
- **OpenSpec proper SDD flow**：`openspec/changes/pr6-autoplan-findings/` 先 propose 後 apply（merge 後 archive）。對齊 CLAUDE.md「禁止跳過 propose」。

### Tests
- 501 → **522** (+21) 測試總數

## [2.0.2.2] - 2026-04-21

Design review v2 follow-up cleanup。清除 6 項 low tech debt + editorial logo 一致性 + QA 測試邏輯修正。這次走完整 OpenSpec `propose → apply → archive` 流程（補 PR 1-4 跳過的 SDD 規範）。使用者體感：StopDetailPage 點 logo 也可以回首頁了（跟其他頁一致）。其餘是 inline-refactor 無視覺變動。

### Changed
- **StopDetailPage header 改用 `<TriplineLogo>` component**：原本是 inline `Trip/Line` wordmark，editorial「logo → home」慣例 PR 1 只修到 PageNav 內的 logo，現在 StopDetailPage 也對齊（點 logo `navigate('/')`）。
- **`DaySection` 2 處 inline `style={{}}` 搬到 CSS class**（`.ocean-hero-chips` / `.ocean-hero-chips-left`）：避免 React re-render 產生新 object ref (RBP-22)。警告 banner 的 `style` 因含 `var(--color-warning)` 動態值保留。
- **`TripMapRail` scoped style 改 singleton injection**：原本 inline `<style>` 每 render 產生新 node，改 `document.head.querySelector` guard + 一次 inject。`<TripMapRail>` 多實例共用同一 style node。
- **`OverflowMenu.needsDivider` 邏輯簡化**：移除 `|| prev.action !== item.action` 分支（PR 3 後 group structure 已充分表達 divider 語義）。divider 位置不變，由 structural test 守住。

### Removed
- **`src/components/trip/InfoPanel.tsx`**：PR 3 後 sidebar 已刪，InfoPanel orphan（無任何 `import InfoPanel` 存在），本 PR 完整移除。
- **`css/tokens.css` dead classes**：`.ocean-body` / `.ocean-main` / `.ocean-side` / `.info-panel` 及對應 `@media print` fallback、`--info-panel-w` CSS variable。
- **`src/pages/TripPage.tsx` SCOPED_STYLES dead rule**：`.print-mode .info-panel { display: none !important; }` InfoPanel 刪後已無用（/review HIGH finding）。

### Fixed
- **`.playwright-mcp/qa-pr3.mjs` T8 sticky 邏輯**：原本 assert 「scroll 前後 top 相同」誤判（sticky 設計就是要改變）。改 3-step scroll：initial → scroll 400（sticky 啟動 top≈nav-h 48）→ scroll 800（保持 top≈48 不變）。T8 現 pass。

### Added
- **`tests/unit/dead-css-cleanup.test.ts`**：守住 tokens.css 跟 TripPage SCOPED_STYLES 不再含 `.info-panel` 等 dead rules。
- **`tests/unit/stop-detail-topbar-layout.test.tsx`**：375px narrow viewport structural assertion（back-btn + crumb + TriplineLogo 三欄 flex layout 不 overflow）。
- **`openspec/changes/archive/2026-04-21-pr5-cleanup-follow-up/`**：完整 propose + apply + archive 流程文件（proposal / tasks × 7 F / design / plan / progress.jsonl）。這是 design-review-v2 cycle 後首次嚴格走 OpenSpec SDD 的 PR。

### Tests
測試總數：469 → **501**（+32）。新增覆蓋：
- `F001-F007` 每個 feature 的 red test（dead-css、onClearSheet optional、inline style removed、singleton injection、needsDivider grouping、StopDetailPage TriplineLogo、TripPage SCOPED_STYLES、stop-detail-topbar-layout）
- F007 QA script T8 修正後 verify pass

### 意義
本 PR 除了清 tech debt，更重要的是：這是 `design-review-v2` 系列 4 個 feature PR 後**首次嚴格走 OpenSpec SDD 流程**（PR 1-4 都跳了 propose → PR 4 retrofit 補寫、PR 5 pre-implementation 寫）。之後 PR 全部須先 propose 再實作，禁止再跳過。

## [2.0.2.1] - 2026-04-21

OpenSpec retrofit + 文件同步。Design review v2 的 3 個 PR（v2.0.1.1 / v2.0.1.2 / v2.0.2.0）未走 OpenSpec `propose` 流程，違反 CLAUDE.md 規範。本次事後補齊完整 spec trail，並把 CLAUDE.md 過時描述同步到 v2.0.2.0 實際狀態。對使用者無功能變更。

### Docs
- **`openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`** — 完整 retrofit change archive：proposal / tasks (27 item × 3 phase) / design (14 題 Q&A 決策) / plan / progress.jsonl
- **`openspec/specs/mobile-bottom-nav.md`** — 4-tab route-based IA 規格
- **`openspec/specs/trip-map-rail.md`** — sticky desktop map rail 規格（≥1024px 斷點、clamp 左欄、Leaflet NaN guard）
- **`openspec/specs/day-palette.md`** — 10 色 Tailwind -500 qualitative palette（DESIGN.md Data Visualization 例外的落地規格）

### Changed
- **CLAUDE.md**：`ManagePage` 標注 AI 編輯聊天（非「行程列表」）、加入 `TripMapRail` component、新增 Desktop 2-col layout 段落、新增 MobileBottomNav 4-tab 段落、開發規則加「未走 OpenSpec propose 須補 retroactive archive」條文

## [2.0.2.0] - 2026-04-21

IA 重構 + desktop map rail。Design review v2 的最後一波，把行動 nav 從 5 tab 雜訊收斂到 4 個 route、desktop 從 sidebar 塞小卡改成 sticky 大地圖。使用者體感：
- 桌機打開行程頁，右邊常駐一張全行程地圖，scroll 時跟著，點 pin 直接進 stop 詳情
- 手機底部 tab 只剩 4 個且每個都通到一個 route（不再是混 scroll / 開 sheet / 跳頁的雜燴）
- 每天的 hero 有「看地圖」chip，一鍵看當天全部 stops 在地圖上的分布
- 每天的路線在地圖上用不同顏色（10 色輪流），一眼分得出今天路徑跟明天路徑

### Added
- **`TripMapRail` 新 component**：桌機 ≥1024px 右欄 sticky Leaflet 地圖。全行程 pins + 每天不同色 polyline，點 pin 直接 `navigate('/trip/:id/stop/:entryId')`。地圖高度 `calc(100dvh - nav-h)`，左欄 scroll 時地圖固定。
- **Day color palette (`src/lib/dayPalette.ts`)**：Tailwind 10 色 `-500` (sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald)，day 1-10 輪流；超過 10 天 modulo wrap；0/負數/NaN/Infinity 都 fallback 到 day 1 色（`dayColor()` 有完整 guard）。對應 DESIGN.md 的 Data Visualization 例外。
- **Day Hero「🗺 看地圖」chip**：每天 eyebrow 右側 Ocean 色 link，導到 `/trip/:id/map?day=N`，MapPage 讀 query param `fitBounds` 到當天 pins。
- **`MobileBottomNav` 的 `看地圖` chip icon**：Icon.tsx 補 `map` SVG（line-stroke 1.75px pinpoint + 方格）。
- **`useMediaQuery` hook (`src/hooks/useMediaQuery.ts`)**：SSR safe，同步讀 `window.matchMedia`。
- **11 個 new unit tests**：`dayPalette`（10 色 + guard）、`mobile-bottom-nav-route`（active 判斷不誤觸 `/manage/map-xxx`）、`trip-map-rail-visibility`、`trip-map-rail-focus`、`day-section-map-link`、`map-page-day-query`、`no-inline-day-map`、`useLeafletMap` NaN zoom guard。測試總數：424 → **469**。

### Changed
- **`MobileBottomNav` 5 tab → 4 tab route-based**：
  - 行程 → `navigate('/trip/:id')` + scroll-to-top
  - 地圖 → `navigate('/trip/:id/map')` ← 新
  - 訊息 → `navigate('/manage')`（原本叫「編輯」）
  - 更多 → 開 `action-menu` sheet
  - Active 狀態改讀 `useLocation().pathname` + regex `/\/trip\/[^/]+\/map/` 嚴格比對。
  - CSS `grid-template-columns: repeat(5, 1fr)` → `repeat(4, 1fr)`。
- **Desktop 2-col layout**：
  - `<1024px`：單欄（mobile-first）+ bottom nav 地圖 tab 看地圖
  - `≥1024px`：`grid-template-columns: clamp(375px, 30vw, 400px) 1fr` 左行程右 map rail
  - 斷點依據：iPad Pro 13" portrait (1024px) 才啟用雙欄；11" 以下 portrait 維持單欄（map rail 擠，直接 map tab 全畫面體驗更好）。
- **`DaySection` 拿掉 inline `<OceanMap mode="overview">`**：每天不再內嵌一張小地圖。全行程地圖由桌機右欄 map rail + 行動端 `/trip/:id/map` tab 承擔。
- **Desktop `OverflowMenu` 補 3 個 sheet 入口**：今日路線 / AI 建議 / 航班（PR 1 砍 topbar dead tab 後 desktop 失去這三個入口的 tech debt 在這補齊）。
- **`TripPage.tsx` 清理**：topbar 中央 tab bar shell 整個拿掉（PR 1 砍 button，PR 3 拿 container）；body render 不再依賴 `activeTripId` selector race，直接用 `trip.id`。

### Fixed
- **`useLeafletMap.fitBounds` single-pin NaN zoom**：map 尚未完全 init 時 `getZoom()` 可能回 NaN，`Math.max(NaN, 14)` 會讓 setView 變 NaN 靜默失敗。加 `Number.isFinite(z)` guard。

### Design System
- **Desktop sidebar 刪除**（progress / 今日行程 / 住宿 3 張小卡）：editorial direction 認這些是 chrome 而非核心內容，main timeline 跟 map rail 已充分覆蓋。配合 user 選項 Q1=A。
- **IA 從混血（tab bar + action bar）回歸純 tab bar**：4 tab 全部是 route-based section 切換，每個 tab 是獨立 view，對齊 iOS HIG 原則。
- **10 色 day palette 是 DESIGN.md Color section Data Visualization 例外的第一個落地**：UI chrome 仍嚴守 Ocean 單 accent。

## [2.0.1.2] - 2026-04-21

設計系統對齊：mobile 字體不再用 em 繼承縮小、三種 glass blur 收斂成一個、警語改 warning 色、AI 編輯 pill 回歸 Ocean 單一 accent。使用者體感：手機讀行程字變整齊、注意事項不再像錯誤訊息、整體視覺語彙一致。

### Added
- **Mobile Type Scale (DESIGN.md)**：新增 `## Type Scale (Mobile ≤760px)` 完整表格，body 在 mobile 下降到 16px、callout 15px、subheadline 14px，其他維持 desktop 尺寸。760px 斷點刻意設在 iPad mini portrait (744px) 以下 + iPad 10/11 portrait (810/820px) 以下，所有 tablet ≥768px 維持 desktop scale。
- **Data Visualization 例外**（DESIGN.md Color section）：明文允許地圖 polyline、chart series 用 10 色 qualitative palette（Tailwind `{sky,teal,amber,rose,violet,lime,orange,cyan,fuchsia,emerald}-500`），UI chrome 仍嚴守 Ocean 單 accent。為 PR 3 的 day palette 先鋪路。
- **Token `--font-size-eyebrow: 0.625rem` (10px)**：補齊 DAY 01 / STOPS 等大寫 section header 專用字級。`caption2 (11px)` 保留給 NIGHT 1 等最小 meta label。
- **Token `--blur-glass: 14px`**：所有 glass 材質（topbar / bottom-nav / sheet）統一使用。

### Changed
- **Glass 統一 14px**：`.ocean-topbar`、`.ocean-bottom-nav`、`InfoSheet` 全部 `backdrop-filter: blur(var(--blur-glass))`。原本 12 / 14 / 28 三種 blur 強度收斂到一個。
- **Sheet 拿掉 `saturate(1.8)`**：對齊 editorial clean direction，sheet 不再做 HDR-like 飽和度拉升。配合 bg opacity 88%→94% 維持邊緣可見度。
- **AI 編輯 pill 改 Ocean fill**：從黑底 + cyan dot 改成 Ocean accent 填色 + 白字。補齊 hover (`brightness(0.92)`) / focus-visible (白色 ring) / active (`brightness(0.85)`) 三個 state。單一 Ocean accent 原則回歸。
- **注意事項卡 destructive → warning amber**：`#C13515` 紅 → `#F48C06` 橘黃。警語不再跟錯誤訊息同色，semantic 準確。
- **Stop card title 確認 17px (headline)**：DESIGN.md 定義 stop name = headline 17px，PR 1 已對齊，本 PR 加測試守住。
- **Hardcode 10/11px 全面 token 化**：tokens.css、DayNav、InfoBox、Shop、Restaurant、ManagePage、MapPage、StopDetailPage 所有 font-size 10px/11px 改用 `var(--font-size-eyebrow)` / `var(--font-size-caption2)`。
- **DESIGN.md `caption2` 與 `eyebrow` 命名分離**：明文寫清楚用途不同，避免未來誤用。

### Fixed
- **`.ocean-bottom-nav-btn` tap target**：padding 10px → 13px + `min-height: 44px` 防呆，符合 Apple HIG 44×44 觸控目標最小值。
- **`.color-mode-preview .cmp-input`**：`border-radius: 4px` hardcode → `var(--radius-xs)` token，消除設計系統破口。
- **`[data-tl-card]` 拿掉 `blur(6px)`**：DESIGN.md 明確寫「不再給 timeline card 用 glass」，實作對齊。

### Tests
- 新增 36 個單元測試（pr2-tokens、pr2-mobile-scale、design-md-sections）：
  - DESIGN.md 要有 Mobile Type Scale section + DV 例外條文
  - tokens.css 要有 `--font-size-eyebrow` + `--blur-glass` 宣告
  - CSS 不得再出現 `blur(12px)` / `blur(28px)` / `saturate(1.8)`
  - `.ocean-bottom-nav-btn` padding + min-height 守住 tap target
  - AI pill `:hover` / `:focus-visible` / `:active` state 存在
- 測試總數：388 → **424**。

## [2.0.1.1] - 2026-04-21

Design review 後的 Tier 0 bug fix：補缺 icon、清死連結、修字體破洞、修 user-trap。使用者體感：底部 5 個 tab 每個都有 icon、topbar 不再有點了沒反應的按鈕、權限管理頁點 logo 可回首頁。

### Fixed
- **MobileBottomNav「編輯」「更多」終於有 icon**：原本這兩個 tab 只有文字（10px 極小），另外三個（行程/建議/航班）有 icon。現在整排一致。
- **Topbar 三個死連結拿掉**：「路線 / 航班 / AI 建議」點下去沒反應（router 沒掛對應路由），整個拿掉避免誤導。原本開啟的 sheet 仍可從底部 bar 觸發。
- **AdminPage 不再 dead-end**：`/admin` 原本右上有 × 關閉但那是獨立頁不是 modal，按瀏覽器返回可能跳外站。改：`TriplineLogo` 包 `<Link to="/">`，點 logo 可回首頁（所有頁面通用）；AdminPage 右上 × 移除，避免 modal/page 混淆。
- **非整數字體破洞**：DayNav eyebrow 9.5px、day-chip area 11.5px、hero eyebrow 10.5px、InfoBox heading 10.5px、Manage hero eyebrow 10.5px 改為整數 10/11px 對齊 DESIGN.md type scale。原本因 `em` 繼承失控產生的 subpixel render 不一致消失。

### Changed
- **`TriplineLogo` 統一變成 `<Link to="/">`**：所有頁面（ManagePage / AdminPage / TripPage / MapPage / StopDetailPage）左上 logo 都可點回首頁。對齊 Airbnb / NYTimes 等 editorial 網站慣例。
- **`PageNav.onClose` 改 optional**：modal-like 頁面傳 `onClose` 才會 render × 按鈕，standalone page 省略即可避免語意混淆。
- **`Icon.tsx`**：補 `edit`（鉛筆）與 `menu`（三橫線）SVG；刪除重複且未使用的 `pencil` entry。

### Added
- **18 個新單元測試**：`tripline-logo-link`（link 導向 `/`）、`icon-edit-menu`（edit/menu SVG 非空）、`mobile-bottom-nav-entries`（5 個 tab 全 render）、`no-fractional-fontsize`（CSS 非整數 px guard）、`trip-page-sheet-default`（RTL mount 驗 sheet 預設關）、`admin-page`（TriplineLogo link 可達）。測試總數 370 → 388。

### Dev infra
- **`vite.config.ts` 加 `optimizeDeps.include: ['leaflet']`**：解決 pull 後 dev server 無法 resolve `leaflet` 卡住 OceanMap 的問題。leaflet 是 CJS/ESM 混用包，vite 8 的 on-demand 自動 prebundle 觸發 race；`supercluster` 是純 ESM 不需手動 include。

### Known limitations（留 PR 3）
- **Desktop 失去 `today-route` / `suggestions` / `flights` 3 sheet 入口**：目前只有 MobileBottomNav 能開啟（mobile 仍正常）。PR 3 IA 重構會改成 4-tab route (`行程 / 地圖 / 訊息 / 更多`)，完整補 desktop 入口。
- **font-size 目前仍 hardcode px**：對齊 DESIGN.md type scale 但還沒全部用 CSS token。PR 2 Typography pass 會補 `--font-size-eyebrow` 等 token，`tokens.css:304` 的 `border-radius: 4px` pre-existing 未用 `var(--radius-xs)` 也一併處理。
- **`.ocean-bottom-nav-btn` padding 41px < 44px Apple HIG**：pre-existing，PR 2/3 會一起修到 ≥44px。

## [2.0.1.0] - 2026-04-20

Ocean v2 發布後的 `/simplify` code health 循環：消除重複、收斂 helper、優化地圖效能、補足單元測試。使用者體感：地圖切換景點反應更快、無視覺變化。

### Changed
- **OceanMap marker cache 重構**：拆成 create effect（pins 變動時建 marker）+ diff 式 update effect（focus 變動時只 `setIcon` 受影響的 2~5 個 marker）。原本每次 focus 切換全量重建整層 `L.LayerGroup`，10 pins × 5 次切換 = 50 次 marker 重建；現在只剩 ~10 次 setIcon。
- **OceanMap cluster path 拆 create/update**：Supercluster index 建一次，focus 變動用 `clusterRefreshRef` 觸發 `refresh()`，不再重建 index。TripPage overview >10 pins 的 cluster 模式大量級也受益。
- **Segment polyline 改 `setStyle`**：`isActive` 切換不再 `remove()` + `L.polyline()` 重畫，直接改屬性。
- **`pinIndexById` Map 取代 `pins.findIndex`**：marker 迴圈內每個 pin 都查 O(N) → 一次性建 Map 後 O(1) 查。

### Added
- **`BreadcrumbCrumbs` 共用組件**：StopDetailPage/MapPage 的 crumb 分段渲染抽出來，用 `classPrefix` 支援各頁 scoped style。
- **`mapDay.ts` 三個共用 helper**：`findEntryInDays`（跨日查 entry）、`parseLocalDate`（YYYY-MM-DD 嚴格解析，拒絕 `2026-02-30` rollover）、`formatDateLabel`（M/D 無補零）。StopDetailPage、MapPage、DayNav 三處重複定義收斂。
- **21 個新單元測試**：涵蓋三個新 helper 全部分支（null / invalid / happy / 邊界）、`BreadcrumbCrumbs` 6 項行為、`formatPillLabel` fallback 路徑。測試總數 340 → 364。

### Fixed
- **focus state 同步修正**：OceanMap update effect 的 deps 加 `map` / `onMarkerClick`，避免 create 重建後 focus state 被 reset 成 idle。
- **`parseLocalDate` 拒絕溢位日期**：`2026-02-30` 原本會被 JS Date 靜默解讀為 3/2，現在加 round-trip 檢查正確回傳 null。
- **`markersRef` cleanup 條件式 reset**：Strict Mode 雙 mount 之間避免新 map 被舊 cleanup 清空。
- **`focusStateRef` 移進 useEffect**：原本在 render phase 直接賦值違反 React 純度，concurrent render abort 會讓 ref reflect aborted state。
- **`findEntryInDays` 加 `Number.isFinite` 守衛**：`entryId=NaN` 直接 return null。

### Removed
- **`height: 100% !important` CSS hack**：改用 `fillParent` prop + `[data-fill-parent="true"]` selector。
- **重複的 `findEntryInDays` / `formatDateLabel` 定義**：StopDetailPage、MapPage 兩處拷貝刪除。
- **DayNav 三處 `new Date(date + 'T00:00:00')` 手寫 idiom**：統一用 `parseLocalDate`。

## [2.0.0.0] - 2026-04-20 — Ocean 大改版里程碑

這版宣告 Ocean 重設計（PR1 Leaflet 基建 + PR2 景點詳情頁 + PR3 全圖地圖頁）完整發布。
所有主要頁面視覺語言統一為 Airbnb editorial 風（白底 + hairline + rounded-xl + 單一 Ocean accent）。

### Added
- **全圖地圖頁 `/trip/:id/map` + `/trip/:id/stop/:id/map`**：行程一覽頁與景點明細頁的地圖現在都能切到全螢幕模式。入口是地圖右上的 `⤢` expand icon。
- **Funliday 風互動地圖導覽**：全圖頁由上到下是 breadcrumb topbar + 全螢幕 OceanMap + 日期 tabs（underlined style）+ 橫向 swipe entry cards（snap-scroll）。日期 tab 切換當日、card swipe/click 讓 map flyTo 該景點。IntersectionObserver 偵測中央卡片自動同步 focus。
- **Deep link 支援**：從 StopDetailPage 的 `⤢` 進入會自動切到該景點所屬日期並 focus；從 DaySection map 進入會鎖定那一天；從 trip overview 進入預設 Day 1。

### Changed
- **Padding trick centred swipe cards**：`.map-page-cards padding-inline: max(16px, calc(50% - 110px))` 讓第一張和最後一張 card 都能 snap 到 centre，不會卡左/右邊。

## [1.3.4.0] - 2026-04-20

### Added
- **ManagePage `/manage` 整頁重新設計**：跟景點詳情頁統一視覺語言 — breadcrumb topbar（sticky glass blur + 52px + ← back button + eyebrow「AI 編輯」+ trip selector pill + Trip/Line online logo）+ hero「訊息紀錄」title + subtitle「修改行程內容或向 Tripline 請教建議，處理時間約 30 秒」。chat bubble 去 AI slop（border-l-[3px] border-accent quote 改 hairline box）、mode toggle「修改/提問」改 outline-only pill、input bar 去 shadow-md 改 hairline + focus-within accent。
- **401/403 AuthRequiredCard**：`/manage` 認證失敗從「無法存取，請重新整理頁面」模糊訊息改 editorial card，本機顯示 `.dev.vars` + `DEV_MOCK_EMAIL` 設定步驟 + code snippet，生產顯示「前往 Cloudflare Access 登入」accent button。

### Fixed
- **Markdown parser 處理 legacy DB 資料**：renderMarkdown 兜底 unescape literal `\n`（兩字元）→ 真換行、`\t` → tab、`\|` → |；保留 fenced code blocks 內字元不動。解決 AI 回覆的 `## 標題\n\n內容\n- item` 表格 / 標題 / bullet list 顯示破掉的問題。
- **Icon registry 補 chevron-left / chevron-right**：ManagePage + StopDetailPage 的返回按鈕以前因為 Icon 元件對未知 name 回 null，`<Icon name="chevron-left" />` render 成空 button，使用者看不到 affordance。現已補進 Material Symbols path data。
- **本機 mock auth 文件修正**：CLAUDE.md 原寫「`.env.local` 的 `DEV_MOCK_EMAIL`」實際上 wrangler 只讀 `.dev.vars`。新人 onboard 設錯地方導致 `/manage` 一直 401。`.dev.vars.example` 補 `DEV_MOCK_EMAIL` + `ADMIN_EMAIL` 範例 + 註解、CLAUDE.md 指向正確檔案 + 附 `cp .dev.vars.example .dev.vars` 指令 + 重啟 dev 提示。

## [1.3.3.0] - 2026-04-20

### Changed
- **景點詳情頁重新設計（Airbnb editorial 風）**：StopDetailPage layout 整頁重寫 — breadcrumb topbar 取代重複標題、hero title 放大 26-30px、地圖套 rounded 16px 卡片 + aspect-ratio 16:9 + 雙層 shadow、desktop CTA 改 inline（不再 sticky 蓋住內容）、subtitle/note 字級升到 16px body。Mobile topbar breadcrumb 不再換行，trip title 桌機才顯示。
- **餐廳正備選視覺層級分明**：`Restaurant` 元件改白底 + 1px hairline border + rounded-xl，新增 `variant="hero"` 給正餐廳（accent outline + 淺藍漸層底），`variant="standard"` 給備選。InfoBox `RestaurantsBox` 整片 `bg-accent-bg` 藍底拿掉，改 eyebrow heading（10px uppercase + accent icon），備選改精簡 row（name + category + rating + chevron），展開後 render standard Restaurant 卡片。
- **購物必買 chip 化**：`Shop` 元件必買從「沖繩甜王草莓、山芋片、金枕紅心西瓜」inline 一串文字改成每項獨立 accent pill chip（dashed top border 區隔），category 從 `<strong>xxx：</strong>` 改成 rounded-full chip，白底 + hairline 卡片。
- **DayNav 瘦身 ×2**：chip 從 4 行堆疊（DAY + 日期 + 區名 + 6 dots）改成單行水平排版「DAY 01 · 7/29 Wed · 北谷」，高度 147 → 55px（-63%）。桌機再改 GitHub/Apple HIG underlined tab style（無 border、accent 文字色 + 2px underline active），55 → 37px。總 chrome（topbar + daystrip）13% → 11%。Mobile 維持 pill card style（橫滑 snap-scroll）。
- **InfoBox 家族整體同步**：Hotel 展開的 parking / shopping panels 也獲益於 InfoBox wrapper redesign（去藍底 + eyebrow + hairline）。

## [1.3.2.0] - 2026-04-19

### Added
- **POI 景點詳情頁 `/trip/:tripId/stop/:entryId`**：點任一景點跳新頁，顯示 Ocean 地圖（單點聚焦 280px）+ DAY/日期/時間 eyebrow + 大標 + 備註 + 相關資訊（infoBoxes：餐廳備選/停車/預約等）+ 底部 accent 圓角按鈕「在 Google Maps 開啟導航」。手機/桌機共用同一 layout，桌機 maxWidth 720px 置中。
- **`TripLayout` + `TripContext`**：`/trip/:tripId/*` 子路由共用同一份 trip+days fetch，StopDetailPage 不再重抓。
- **`useScrollRestoreOnBack` hook**：從詳情頁按返回時，TripPage 自動捲回原 entry（`useLayoutEffect` + `requestAnimationFrame` + `[data-scroll-anchor]` 查找），用完 state 自動清空避免重捲。

### Changed
- **Timeline row 整行可點**：手機 `TimelineRail` + 桌機 `TimelineEvent` 整個景點 row 現在都是 tap target（Enter / Space / click 皆觸發），跳到詳情頁。桌機 row `role="button"` + focus-visible outline，hover 時右側 chevron 前推 3px。
- **拿掉 inline expand**：原 TimelineRail 展開段（note / description / locations / infoBoxes）移到 StopDetailPage 承接。精簡 row 視覺，只留 name/time/type/rating/note。

### Migration
- Router 結構從平坦 `<Route path="/trip/:tripId" element={<TripPage />} />` 改為 nested layout：
  ```
  /trip/:tripId        TripLayout
    ├── (index)        TripPage
    └── stop/:entryId  StopDetailPage
  ```
- `TripLayout` 只做 `useTrip(urlTripId)` + provide context；TripPage 繼續用自己的 `resolveState`（處理 unpublished / default fallback）不動。SW cache 吸收 2× fetch。

## [1.3.1.0] - 2026-04-19

### Changed
- **地圖全面遷移 Google Maps → OpenStreetMap (Leaflet)**：拔除 `@googlemaps/js-api-loader` 依賴，改用 `leaflet` + OSM tile（light = OSM 主站、dark = CartoDB Dark Matter）。省 API billing、載入時間改善、支援未來 Service Worker offline tile cache。
- **新 `<OceanMap>` 元件統一兩個地圖入口**：取代 `<DayMap>`（單日）和 `<TripMap>`（全行程）。props: `mode: 'detail' | 'overview'` + `focusId` + `routes` + `cluster`。overview 模式 >10 站自動 supercluster。
- **路線資料層改 Mapbox Directions free tier（100k/月）透過 CF Worker `/api/route` proxy**：token 永不暴露前端（存 CF Pages secret）、IndexedDB LRU cache 100 條、fetch 失敗自動 fallback Haversine 直線 + 虛線 + `approx: true` 標記。

### Added
- **`useLeafletMap` hook**：管理 Leaflet map instance 生命週期，Strict Mode idempotent guard（檢查 `container._leaflet_id`），`flyTo` 支援 `prefers-reduced-motion`，暗色模式動態切換 tile provider 不 remount。
- **`useRoute(from, to, opts?)` hook**：單 segment 懶載入 polyline，IndexedDB cache（`idb` wrapper）+ LRU eviction，支援 `fromUpdatedAt`/`toUpdatedAt` cache invalidation（POI 座標變更時失效）。
- **Ocean 編號 pin marker**：數字圓形 marker（focused accent 36px / idle 28px / past 灰），跟手機 timeline rail dot 設計同源。

### Removed
- `src/components/trip/DayMap.tsx`（340 行，Google Maps 單日地圖）
- `src/components/trip/TripMap.tsx`（364 行，Google Maps 多天總覽 + Day 色盤 legend）
- `src/components/trip/MapMarker.tsx`（256 行，Google Maps 自訂 InfoWindow overlay）
- `src/components/trip/MapRoute.tsx`（268 行，Google Maps DirectionsRenderer + travel label overlay）
- `src/hooks/useGoogleMaps.ts`（92 行，Maps JS API loader）
- `src/hooks/useDirectionsRoute.ts`（176 行，Google Directions Service hook，batch+cache 邏輯移植到 `useRoute`）
- 6 個舊 Google Maps tests（`day-map`/`trip-map`/`map-marker`/`map-route`/`use-directions-route`/`day-map.spec.ts`）
- `GOOGLE_MAPS_URL_BASE` 常數改名為 `EXTERNAL_NAVIGATION_URL_BASE`（避免誤導為 Platform API）

### Migration
- 新增 CF Pages env var：`MAPBOX_TOKEN`（public `pk.*` token，domain-restricted）
- 既有 `useMapData` / `extractPinsFromDay` 純資料邏輯保留不動，供新舊兩套共用。
- Day 色盤 legend 不再沿用（Ocean 單一 accent），overview 模式以 cluster 數字取代。

## [1.3.0.0] - 2026-04-19

### Added
- **Ocean 單主題設計系統**：依 Claude Design 產出的 Okinawa Trip Redesign / Mobile mockup 做整體視覺重設計。純白底 + 海洋藍 `#0077B6` accent + Airbnb 風格三層陰影 + hairline border + Inter/Noto Sans TC 字型。
- **Ocean 版 Topbar**：sticky glass blur + 32×32 logo 方塊 + Trip/Line brand + nav tabs（行程/路線/航班/AI 建議）+ 右側 action buttons（緊急/列印/更多 dropdown/AI 編輯 dark pill）。
- **OverflowMenu 元件**：topbar 右側「更多」按鈕下拉，9 個功能項 + 分隔線（出發清單/雨天備案/交通統計/切換行程/外觀設定/匯出 PDF/MD/JSON/CSV）。React portal + position:fixed，任何 ancestor overflow 都切不到。
- **Day chip 160px rich 版**：DAY XX eyebrow + 26px 大日期 + dow + area + 真實 stops 數畫 progress marks（超過 6 顯示 +N）。
- **Ocean Hero card**：每日 Ocean primary 藍底白字 + eyebrow chips + 32px title + Stops/Start/End stats 3 格。
- **4-col Stop card**（桌機）：`68px time | 48px icon | content | actions` grid，sight/food Ocean accent，其他 ink。
- **Compact Timeline Rail**（≤760px 手機）：54px 時間欄 + 1px 豎線 + 10px dot + 可點展開 note。
- **Mobile bottom tab bar**：5 tab（行程/編輯/建議/航班/更多）with Ocean active highlight + safe-area。
- **Action menu sheet**：手機「更多」tab 開 3×3 功能 grid + 匯出 row（替代桌機 dropdown）。
- **FlightSheet 元件**：把航班 DocEntry 解析成雙大字 `TPE 18:30 → OKA 20:50` 卡片，含座位、登機門、確認狀態 dot。Fallback 到原 description 當 parser 認不出結構。
- **SuggestionSheet 元件**：把 AI 建議按關鍵字分 3 層（高/中/低）優先級，左側 4px accent border 項目卡。
- **Sidebar SideCards**（桌機）：整體進度（7 格 progress bar + 第 X 天）/ 今日行程 / 住宿安排（全程合併夜數）/ 當日交通 / 航班（Outbound/Return monospace）。
- **TripLineLogo 三線 lego mark**：32×32 Ocean 方塊 + 3 條遞減 opacity 橫線 + 3 個 stud dots。
- **useMediaQuery hook**：SSR-safe React hook 訂閱 media query change event，供 Timeline 依螢幕寬切 rail/card。

### Fixed
- **手機 Timeline Rail 展開列補回 InfoBox + NavLinks**：修復 Ocean 重設計後手機餐廳備選、停車資訊、預約連結等 infoBoxes 不顯示的 regression。TimelineRail 展開段原只渲染 note + description，現補 locations (NavLinks) + infoBoxes (含 restaurants / parking / reservation 等 6 種 box)。同時把 item 根節點從 `<button>` 改成 `<div>` + 裡面單獨 `<button class="ocean-rail-head">`，避免 button 裡嵌 button/a 的 HTML 違規。
- **手機 Timeline Rail 對齊 + 編號 + 字級**：原本時間/圓圈用 absolute 定位算錯 3-4px，改成 `grid-template-columns: 44px 24px 1fr`（time/dot/head 三欄 + column-gap 10px）自然置中對齊。圓圈放大到 24×24 裝入景點編號（accent 色 / now 態藍底白字）。rail-name 13→15px、rail-sub 10→12px、rail-time 12→13px、expand 12.5→14px，eyebrow/meta 10→11px。豎線 left 對準 dot 中心 x=66。

### Changed
- **DayNav 日期總覽列改為 sticky**：`.ocean-day-strip` 加 `position: sticky; top: 64px`（手機 56px）+ backdrop-blur + hairline border，捲動時釘在 topbar 下方。負 margin bleed 到 viewport 邊緣讓毛玻璃底色蓋滿。`.ocean-day` scroll-margin-top `84px → 210px`（手機 190px）、`.ocean-side` top `84px → 200px` 避免 sticky 堆疊重疊。chip 視覺格式 100% 保留。
- **theme 系統簡化為單一 Ocean**：刪除 `sun/sky/zen/forest/sakura/night` 六套主題，`useDarkMode` 移除 `ColorTheme` / `setTheme` / `THEME_CLASSES`，只管 `light/auto/dark`。`appearance.ts` 移除 `COLOR_THEMES` + `THEME_ACCENTS`。TripSheetContent 的外觀 sheet 只剩色彩模式選擇器（3 個 card）。
- **tokens.css 全面改寫**：砍 1800+ 行六主題覆寫，新增 Ocean light + dark (deep navy `#0D1B2A`) + print 三 variants。radius 對齊 Airbnb（sm:6/md:8/lg:12/xl:16）、shadow 三層中性黑。
- **字型**：system font stack + Caveat 手寫 → Inter + Noto Sans TC（設計稿指定）。
- **meta theme-color**：`#F47B5E` → `#0077B6`。
- **DayNav 整個重寫**：從細 pill + 左右箭頭按鈕改為 160px rich chip 橫向 scroll（不需要箭頭）。
- **TimelineEvent 重寫**：從 polygon time flag + dashed 豎線改為 4-col grid stop card；≤760px 切換到 TimelineRail。
- **InfoPanel 擴充**：原 3 卡變 5 卡（加整體進度 + 住宿安排 + 航班）。

### Removed
- **QuickPanel FAB**：全刪（14 項功能按鈕 + FAB + sheet overlay）。所有功能搬到 topbar nav tabs / action buttons / OverflowMenu dropdown / Mobile bottom nav / action-menu sheet。
- **Edit FAB**（右下角 + 圓形按鈕）：topbar 的 AI 編輯 dark pill 取代。
- **Theme picker UI**：外觀 sheet 裡的色彩主題選擇器（6 個 card）移除，只剩色彩模式 light/auto/dark。
- **ThemeArt 六主題 SVG**：1038 行砍成 53 行，只保留 Ocean wave FooterArt，其餘 null。

### Fixed
- **FlightSheet parser**：容納「出發 → 抵達」格式（時間被文字切開）、label 讀 section 先、機場代碼白名單、航空公司 code 支援虎航 IT / 樂桃 MM / 台灣虎航 IT / 酷航 TR / 越捷 VJ 等。
- **OverflowMenu 下拉被切**：因 topbar overflow 導致 popover clip。改 React portal + position:fixed 徹底避開所有 ancestor stacking/clipping context。

### Migration
- 已存 `colorTheme` localStorage 值（sun/sky/zen/forest/sakura/night/ocean）對 Ocean-only 版本無害：`useDarkMode` 直接忽略該 key，不會 crash。

## [1.2.4.0] - 2026-04-17

### Changed
- **DayNav 日期 pill 等寬**：原本不同字元數的日期（`7/30` 4 chars vs `8/1` 3 chars）pill 寬度不同（63 vs 52px），視覺上一排大小不一、跳動不整齊。改用 `min-w-[4.5em]` 相對單位（mobile 60px / desktop 90px），**所有 pill 等寬**，跟著字體 size responsive 縮放。也加上 `tabular-nums` 讓日期數字等寬顯示，避免 `1` vs `9` 字形寬度差異造成視覺錯位。

## [1.2.3.9] - 2026-04-17

### Removed
- **DayNav sliding indicator**：PR #187 改了 transition curve 想淡化 ghost trail，但使用者實測仍不滿意（切換時視覺上還是「有東西滑過不相干的 pill」）。直接移除整個半透明 indicator layer（`{indicatorStyle && <div>...</div>}` + `useLayoutEffect` + state）。active pill 本身已是實心橘色背景 + 高對比文字（`bg-accent text-accent-foreground`），辨識當前日期完全夠用。移掉這層 additive 效果讓 DayNav 變得乾淨直接。

### For contributors
- `DayNav.tsx` 少了 25 行（state、useLayoutEffect、indicator JSX、相關 transition 註解），也不再 import `useLayoutEffect`。

## [1.2.3.8] - 2026-04-17

### Fixed
- **DayNav 滑動指示器捲動時「底圖變大」到隔壁日期格**：切換日期時指示器用的 spring easing（`cubic-bezier(0.32, 1.28, 0.60, 1.00)`, y1=1.28）會 overshoot 28%，讓指示器衝過目標 pill 到隔壁格短暫停留再彈回；加上 `width` 也同時 spring 造成視覺上像「隔壁 pill 有個比它還大的背景框」。改用純 ease-out curve `--transition-timing-function-apple`（已在 tokens.css 有定義，y2 不超過 1，無 overshoot），指示器現在乾淨滑動到目標 pill，不再污染鄰居。

### Notes
- `--ease-spring` token 保留給 `InfoSheet` / `QuickPanel` 的 bottom sheet 彈出動畫用（那裡 overshoot 是對的 Apple HIG 彈性動畫），未動到共用 token。

## [1.2.3.7] - 2026-04-17

### Changed
- **`scripts/lib/local-date.js`（新）**：把 `daily-check.js` 內聯的 `todayISO()` 抽成共用模組，支援注入時間（`todayISO(now)`）方便測試。`daily-check.js` 改用 `require('./lib/local-date')`。
- **`tests/unit/local-date.test.js`（新）**：6 條單元測試，包含 PR #171 的 regression（凌晨本地 06:13 屬「今天」而非 UTC 前一天）、月日補 0、月初年尾邊界、無參數 smoke。**時區無關**（用 `new Date(y, m, d, h, m)` 本地建構式）在任何 CI runner TZ 下皆穩定。

### For contributors
- 以後修排程 / 時區相關 bug 時請新增對應 regression test 到 `tests/unit/local-date.test.js` 或兄弟檔。

## [1.2.3.6] - 2026-04-17

### Fixed
- **Mobile URL bar 捲動時 active 日期框抖動**：mobile Chrome/Safari 捲動時 `window.innerHeight` 會隨 URL bar 收縮抖動，邊界情境 DayNav active pill 可能 toggle 一次。改用 `document.documentElement.clientHeight`（layout viewport，mobile 穩定）。
- **列印模式 scroll listener 沒清除**：進入列印模式後頁面 scroll listener 繼續觸發 state update。onScroll effect 加 `isPrintMode` 依賴，進入列印模式時 early return 並由 React cleanup detach。
- **切換行程後 URL hash 可能殘留舊值**：scroll-spy 的 dedup ref 跨行程沒 reset，若兩行程首日 dayNum 相同會漏掉第一次 hash 更新。`handleTripChange` 加 ref reset。
- **單天行程或短頁面分享時沒日期錨點**：頁面短於 viewport 時 onScroll 從不觸發，URL 停在無 hash 狀態。新增 `computeInitialHash()` pure function，初次載入完若無合法 hash 自動推入 `#day{today}` 或 `#day{first}` fallback。

### Changed
- **`src/lib/scrollSpy.ts`**：新增 `getStableViewportH()` 與 `computeInitialHash()` 兩個 pure function，抽離自 TripPage 內聯邏輯，好測也避免重複。
- **`tests/unit/scroll-spy.test.ts`**：新增 8 條單元測試覆蓋 mobile viewport 穩定性、今日匹配、單天行程 fallback、非法 hash fallback、空陣列。

## [1.2.3.5] - 2026-04-17

### Fixed
- **右上角日期框捲動時標錯日**：DayNav active pill 在捲動過頁時延遲切換，Day N header 已完整顯示在 sticky nav 下方時仍停在 Day N−1；連帶右側 sidebar「今日行程 / 當日交通 / 今日住宿」顯示錯誤日期的資料。`src/pages/TripPage.tsx` 的 scroll-spy 閾值由 `navH + 10`（header 貼到 nav 下緣才切）改為 `navH + (innerHeight − navH) / 3`（header 進入可視區上 1/3 就切），與 Apple HIG scroll-spy 慣例一致。

### Changed
- **`src/lib/scrollSpy.ts`（新）**：把 onScroll 內的演算法抽成 pure function `computeActiveDayIndex`，null-safe、依單調遞增假設做 early-break，hot path 減少 `getBoundingClientRect` 呼叫。
- **`tests/unit/scroll-spy.test.ts`（新）**：10 條單元測試覆蓋 bug 場景、邊界、mobile viewport 抖動穩定性、null header。

## [1.2.3.4] - 2026-04-16

### Fixed
- **防止 GET /days/undefined 404 錯誤**：`fetchDay` 加入 `Number.isInteger` + 最小值檢查，阻擋 undefined / NaN / 浮點數等無效 dayNum 發出 API 請求

## [1.2.3.3] - 2026-04-13

### Added
- **CI 自動套用 D1 migrations**：新增 `.github/workflows/deploy.yml`，每次 master push 若 `migrations/**` 有變更就自動跑 `wrangler d1 migrations apply --remote`，關閉原本「CF Pages 部署 code 但 schema 還沒更新」的 race window
- **Concurrency lock**：`concurrency: d1-migrations-production` + `cancel-in-progress: false`，防止連續 master push 讓兩個 migration workflow 同時撞 `d1_migrations` tracking table（會造成重複套用或 half-applied 狀態）
- **Fail-loud Telegram 告警**：`if: failure()` step 會在 migration 失敗時立刻推 🚨 到 Telegram，含 commit SHA 和 workflow run URL。不用等到隔天 daily-check 才發現

### Notes
- **起因**：Tier 1 (PR #169) 部署時踩到這個坑 — 新 middleware 預期 `api_logs.source` 欄位存在，但 CF Pages 不會自動 apply D1 migrations，造成 ~2 分鐘的 schema gap，期間所有 4xx/5xx 的 INSERT 靜默失敗（被 `context.waitUntil()` 吞掉，不回 500 但 log 遺失）
- **並行性**：Workflow 並行於 CF Pages build 執行，migration apply 通常 10-30s 完成，CF Pages build 通常 60-120s，因此 migration 在正常情況下會先落地
- **Paths filter**：只在 `migrations/**` 或 workflow 自身變更時觸發，一般 code-only PR 不會浪費 CI 分鐘
- **Manual fallback**：`workflow_dispatch` 允許 GitHub UI 上一鍵重跑（例如失敗後重試）
- **Idempotent**：`wrangler d1 migrations apply` 會追蹤已套用的 migration，no-op case 約 3 秒完成
- **Lockfile-pinned wrangler**：用 `npm ci + npx wrangler`（不是 `npx -y wrangler@4`），吃 `package.json` devDep 的 `^4.80.0` 版本，避免任意 4.x 版本漂移
- **Migration 作者 contract**：D1 不支援跨 statement transaction；若 migration 被 timeout 殺掉，DB 會 half-applied。所有 migration 必須 idempotent（用 `IF NOT EXISTS` / `IF EXISTS`），保證重跑安全
- **Follow-up 未做**：`environment: production` + 環境 scope secrets（supply-chain hardening），需搭配手動 GH settings 變更，未來再做

## [1.2.3.2] - 2026-04-13

### Changed
- `.gitignore` 擴充：排除 `.DS_Store`、`.wrangler/state/`、`.wrangler/tmp/`、`.context/daily-check-*.log`、`.claude/skills/tp-workspace/trigger-results/` 等本地噪音檔，`git status` 不再被 cache/log 淹沒
- 清除誤 commit 的 `.wrangler/tmp/` build cache（af696df 遺留的 7 個 stale 檔）

## [1.2.3.1] - 2026-04-13

### Changed
- 測試覆蓋率強化：`?all=1` batch endpoint 新增 7 個測試（hotel+parking / shopping / travel / location 解析 / 空行程 / batch vs single-day regression guard）
- helpers.ts `seedEntry` 支援 travel + location 欄位，`seedTripPoi` 支援 hotel/shopping context + nullable entry_id

## [1.2.3.0] - 2026-04-13

### Changed
- **行程載入 N+1 修復**：useTrip 從「每天發一個 API 請求」改為「一次批次請求取得所有天」。7 天行程從 9 次 API call 降為 2 次，後端 DB query 從 N×3 降為 4 次固定。
- 新增 `GET /api/trips/:id/days?all=1` 批次端點，一次回傳完整行程資料（含 hotel + timeline + POI 歸類）。既有 `?all=0`（預設）行為不變。
- 共用 POI 組裝邏輯抽到 `functions/api/trips/[id]/days/_merge.ts`（`mergePoi` / `assembleDay` / `fetchPoiMap`），`days/:num` 與 `days?all=1` 兩個 endpoint 共用。

## [1.2.2.0] - 2026-04-13

### Changed
- Weather API 從逐座標 N+1 查詢改為批次查詢 Open-Meteo，一天多個景點只發一次 API call，降低外部請求量

## [1.2.1.3] - 2026-04-13

### Changed
- daily-check Telegram 修復摘要格式：`總數:N 修復:M 不處理:L` → `總計:N 已處理:M 不處理:L`。「已處理」更精準涵蓋實際修復 + skipped（含合理不修的項目均算已處理過）

## [1.2.1.2] - 2026-04-13

### Fixed
- `scheduler-common.sh` 新增 `CLAUDE_BIN` 常數（絕對路徑 `$HOME/.local/bin/claude`），解決 launchd PATH 找不到 `claude` 指令導致 Phase 2 autofix 失敗
- `daily-check-scheduler.sh` 和 `tp-request-scheduler.sh` 改用 `$CLAUDE_BIN`

## [1.2.1.1] - 2026-04-13

### Fixed
- daily-check 日期使用本地時區，修正 06:13 CST 執行時產出檔名標成昨天（UTC）的 bug。原本 `todayISO()` 用 `toISOString().slice(0,10)` 取 UTC 日期，在 CST 凌晨 6 點時 UTC 仍是前一天。

## [1.2.1.0] - 2026-04-13

### Added
- **api_logs 來源標籤**：middleware 在寫入 4xx/5xx log 時分類 request 來源（scheduler / companion / service_token / user_jwt / anonymous），為後續 daily-check 的錯誤來源分析與 scheduler 問題升級鋪路
- `migrations/0024_api_logs_source.sql`：新增 `api_logs.source TEXT DEFAULT NULL`，nullable + 向後相容
- `functions/api/_middleware.ts` `detectSource()` helper：lazy-compute，2xx 成功路徑完全跳過（僅在錯誤路徑寫 log 時才讀 headers）

### Notes
- Tier 1 純基礎建設：source 欄位尚未被 `daily-check.js` 消費，使用者看不到行為變化。消費端會在後續 PR（Tier 2）實作
- 已知 trust boundary：`X-Tripline-Source` / `X-Request-Scope` 為 self-reported，僅作 telemetry 分類，不得用於 auth 決策

## [1.2.0.0] - 2026-04-12

### Changed
- **API 統一 camelCase 回應**：`json()` 內建 `deepCamel` 轉換，所有 API response key 自動從 snake_case 轉為 camelCase（如 `sort_order` → `sortOrder`、`day_num` → `dayNum`）
- 前端 `mapDay.ts` Raw interfaces 全面改用 camelCase，移除所有 snake_case 欄位
- `useTrip`、`useRequests`、`ManagePage` 等同步更新

## [1.1.8.1] - 2026-04-12

### Fixed
- 餐廳首選/備案排序改用 sortOrder 判斷，不再依賴 API 回傳陣列順序（修正 sort_order=0 的首選餐廳被顯示為備案的問題）

## [1.1.8.0] - 2026-04-12

### Added
- PATCH trip-pois 支援 entry_id 欄位：可透過 API 搬移 POI 到不同 entry，含同行程驗證
- mergePoi 回傳餐廳 lat/lng 座標：前端可取得 POI 地理位置

### Changed
- 地圖 pin 優先使用首選餐廳座標：餐廳 entry 若無自身 location，自動 fallback 到 sort_order=0 餐廳的 lat/lng
- tp-create 範本每天必建早餐(08:00)、午餐(12:00)、晚餐(18:00) entry，travel 以首選餐廳位置計算車程

## [1.1.7.0] - 2026-04-12

### Changed
- 餐廳推薦改為首選/備案分層渲染：第一順位完整顯示（hero card），其他順位以精簡列表呈現，點擊展開詳情

## [1.1.6.0] - 2026-04-12

### Added
- POST /api/trips/{id}/days/{dayNum}/entries endpoint：旅伴請求可建立不存在的 entry（如早餐），不再塞到不相關的 entry 下
- companion scope whitelist 加入 POST entries，tp-request/tp-edit skill 同步更新指引

### Changed
- daily-check Telegram 修復摘要格式改為「總數:N 修復:M 不處理:L」，取代原先易混淆的「修復 0/2 項」
- tp-request skill 三條鐵律：POI 語意歸屬檢查、誠實回覆禁止假裝成功
- reply request ID 改由前端渲染（ManagePage 顯示 #N，不存入 reply 資料）

### Fixed
- request-job log 路徑修正到 scripts/logs/tp-request/（含 plist stdout/stderr 路徑 + launchd 重載）
- API server log 補 Claude 處理結果（success/failed）

## [1.1.5.0] - 2026-04-07

### Added
- 事件驅動請求處理：CF Workers POST 後 webhook 觸發 Mac Mini API server 即時處理（取代 cron 輪詢）
- SSE 即時狀態推送：`/api/requests/:id/events` endpoint，前端自動收到 open → processing → completed/failed 狀態更新
- `useRequestSSE` React hook：EventSource 連線 + 自動降級 10 秒短輪詢
- Mac Mini API server (`scripts/tripline-api-server.ts`)：Bun HTTP server，D1 即佇列，mutex 處理迴圈，15 分鐘 Claude CLI timeout
- launchd job (`scripts/tripline-job.sh`)：每 15 分鐘卡住偵測（20 分鐘 stale threshold）+ 遺漏處理
- 處理者追蹤：`processed_by` 欄位記錄 `'api'`（即時）或 `'job'`（排程），前端顯示對應 icon
- iOS 原生風格狀態 badge：pill 形 rounded-full，4 態 + spinner + elapsed time + checkmark/X SVG
- 聊天式請求列表：最新在底部，sentinel 頂部向上捲載入更舊，optimistic append 取代 reload

### Changed
- 請求狀態機簡化為 4 態：open → processing → completed/failed（移除 received）
- PATCH handler：自動更新 `updated_at`，支援 `processed_by` 欄位，`failed` 狀態繞過 forward-only
- GET /api/requests 支援 `sort=asc` + `after/afterId` cursor（ASC 分頁）
- Badge 顏色改用 CSS 變數，支援 6 主題 x light/dark mode
- SSE endpoint 加 `hasPermission` 權限檢查

### Fixed
- Node.js 25 localStorage polyfill（修復 78 個 pre-existing 測試失敗）
- `mapRow` 測試：JSON_FIELDS 同步 V2 cleanup
- SSE hook：移除 `status` 從 useEffect deps（防止重複連線）
- SSE endpoint：加 `cancel()` 清理 timer（防止 client 斷線後 timer 洩漏）
- API server：`TRIPLINE_API_SECRET` 空字串改為 reject（fail-closed）
- .env.local 解析：修正 base64 `=` 截斷問題

## [1.1.4.3] - 2026-04-06

### Changed
- `trip_docs_v2` 表重命名為 `trip_docs`（migration 0022），移除 V2 後綴
- 所有 API handlers / scripts / docs 中的 `trip_docs_v2` 參照更新為 `trip_docs`
- "POI Schema V2" 標記改為 "POI Schema"

## [1.1.4.2] - 2026-04-06

### Fixed
- CI tsc functions 紅燈：修正 _middleware.ts / _poi.ts / rollback.ts / [num].ts / [type].ts 共 35 個 pre-existing strictness errors

## [1.1.4.1] - 2026-04-06

### Removed
- Legacy V1 表 hotels / restaurants / shopping / trip_docs（migration 0021 DROP）
- rollback.ts 移除 trip_docs 白名單
- dump-d1.js / init-local-db.js 移除 4 張 legacy 表
- mapRow JSON_FIELDS 移除 'location'（改由 API handler parse）

### Fixed
- 天氣功能不顯示：API handler 解析 trip_entries.location JSON string 為物件

### Changed
- Location interface 擴充完整欄位（name, googleQuery, appleQuery, mapcode, geocode_status）

## [1.1.4.0] - 2026-04-01

### Changed
- DayMap 路線從直線 Polyline 改為 Google Maps Directions API 實際道路路線
- 路線載入完成前不渲染連線（不再顯示直線 fallback）
- 車程 label 位置改用 Directions API leg 路徑中點

### Added
- `useDirectionsRoute` hook — Directions API 整合、快取、自動 fallback
- `sortPinsByOrder` 共用排序工具函式
- 路線快取（LRU 20 entry 上限）、routes library 按需載入
- Directions API 回傳空路線防護 + console.warn 錯誤日誌
- waypoints 上限 25（Google API 硬限制防護）

## [1.1.3.0] - 2026-03-30

### Changed
- ManagePage 重設計為 iMessage chat 氣泡風格 — 用戶訊息右側 coral 氣泡，AI 回覆左側 sand 氣泡含引用條
- 輸入框改為 pill 形狀，1→5 行自動撐高，修改/提問 toggle 移到輸入框上方
- 訊息排序改為最新在下，開啟時自動捲到底部，往上捲載入舊訊息
- Status 顯示從 stepper 進度條改為氣泡下方小 badge
- `[data-reply-content]` CSS 從 inline `<style>` 遷移到 `tokens.css`

### Removed
- `RequestStepper` 不再由 ManagePage 使用（元件保留供未來使用）
- `SCOPED_STYLES` inline style block

## [1.1.2.0] - 2026-03-30

### Added
- `trip_docs_v2` + `trip_doc_entries` 正規化表 — 取代 JSON blob 的 `trip_docs.content`
- `DocCard` 統一文件渲染元件 — 按 section 分組，支援 markdown content
- Migration 0019 `normalize_docs.sql` — 建立新 relational schema
- `migrate-docs-to-v2.js` 遷移腳本 — 直接操作 D1（wrangler d1 execute）
- API backward compat：PUT 仍接受舊 JSON 格式，自動展開為 entries
- entries 數量上限 200 防護

### Changed
- `GET/PUT /api/trips/:id/docs/:type` 改讀寫 `trip_docs_v2 + trip_doc_entries`
- `useTrip` 移除 JSON double-unwrap，直接使用 API 回傳的 `{ title, entries }`
- `TripPage` 5 個 doc switch case 統一用 `DocCard` 渲染
- `rollback.ts` ALLOWED_TABLES 加入新表
- `dump-d1 / init-local-db / import-to-staging / gen-seed-sql` 同步新表

### Removed
- `Flights.tsx` / `Checklist.tsx` / `Backup.tsx` / `Suggestions.tsx` / `Emergency.tsx` 舊元件
- `TripDoc` type interface（已無用）

## [1.1.1.0] - 2026-03-28

### Added
- POI 正規化：新增 `pois` master 表 + `trip_pois` fork 引用表
- MarkdownText `inline` 模式 — `marked.parseInline()` 避免破壞 TEL/URL 格式
- `buildWeatherDay()` — 從 entries 座標即時推導天氣查詢位置（取代 DB 存儲）
- `migrate-pois.js` / `migrate-trip-docs.js` 資料遷移腳本
- `gen-seed-sql.js` seed SQL 生成工具 + 本地/staging seed 資料

### Changed
- **DB 表名統一**：`days`→`trip_days`、`entries`→`trip_entries`、`requests`→`trip_requests`、`permissions`→`trip_permissions`
- **DB 欄位統一**：`body`→`description`、`rating`→`google_rating`、`details`→`description`、移除 `_json` 後綴
- **mapRow 接入 pipeline**：useTrip + TripPage 套用 `mapRow()` 確保 snake_case→camelCase 轉換
- mapDay 加入 `google_rating` snake_case fallback 確保 API 回傳正確映射
- Hotel/InfoBox/Shop/Restaurant 統一使用 MarkdownText 渲染
- TripPage export（MD/CSV）使用 snake_case 欄位名讀取 raw API data
- API 端點全面更新（17 檔案 — 表名 + 欄位名 + rollback column list）
- Rollback TABLE_COLUMNS 修正（hotels: details→description + 加 location）
- 清除所有舊欄位名 fallback（body/rating/details/address）

### Removed
- `FIELD_MAP` 手動映射常數
- `Weather` interface — 天氣改為即時推導
- `weather_json` DB 欄位 + API response ghost weather field

## [1.0.2.1] - 2026-03-28

### Fixed
- 文字反白（::selection）背景色與頁面底色太接近，改用 `color-mix(accent, 30%)` 確保所有主題可見

## [1.0.2.0] - 2026-03-27

### Added
- Requests API cursor-based 分頁 — `limit`/`before`/`beforeId` 參數，回傳 `{ items, hasMore }`
- ManagePage infinite scroll — IntersectionObserver 觸底自動載入下一頁
- Request message Markdown 渲染 — marked.js + sanitizeHtml（原本為純文字）
- Hotel details Markdown 渲染 — marked.parseInline + sanitizeHtml
- `renderMarkdown()` 共用 helper（ManagePage reply + message 共用）

## [1.0.1.1] - 2026-03-27

### Changed
- TripPage SCOPED_STYLES 從 143 行精簡到 29 行 — 基礎樣式搬到 tokens.css `@layer base`
- tokens.css 新增 page-level base styles（day-header、skeleton、timeline glass、info-panel、appearance cards 等）
- 樣式查找位置從 3 處（tokens.css + SCOPED_STYLES + inline）減為 2 處（tokens.css + inline）

## [1.0.1.0] - 2026-03-26

V2 Cutover — 移除所有 V1 程式碼，V2 成為唯一正式版。

### Changed
- SPA 單一入口 — main.tsx 移除 V1/V2 switching，直接載入 BrowserRouter
- Vite 單入口建置 — 移除 v2.html 雙入口，統一由 index.html 出發
- CSS 統一 — tokens.css 成為唯一 CSS 檔案（Tailwind CSS 4 @theme）
- apiFetchRaw 抽至 useApi.ts 共用模組，加入 reportFetchResult 離線偵測
- toTimelineEntry/toHotelData 改接 object 型別，消除 5 個 `as unknown as` 型別斷言
- TripPage 清除 15 組 `-v2` CSS class 後綴

### Removed
- V1 入口：mainV1.tsx、mainV2.tsx、v2.html
- V1 頁面：TripPage(V1)、ManagePage(V1)、AdminPageV2（冗餘）
- V1 元件：Toast(V1)、RequestStepper(V1)
- V1 CSS：style.css、shared.css、map.css、manage.css、admin.css、setting.css
- 過渡程式：v2routing.ts、features.json、progress.jsonl
- V1/V2 比較測試和 CSS 依賴測試

### Fixed
- scroll-to-now 選擇器從 `.tl-now` 修正為 `[data-now]`
- ManagePage 回覆分隔線 `border-none` 與 `border-t` 衝突
- map-highlight 動畫遷移至 tokens.css（從已刪除的 map.css）

## [1.0.0.0] - 2026-03-25

React SPA 架構完成里程碑 — 從 vanilla JS 全面遷移至 React + TypeScript。

### Added
- React SPA 架構 — Vite 多入口 + React Router + 4 頁 lazy loading（TripPage、ManagePage、AdminPage、SettingPage）
- 6 套色彩主題（陽光/晴空/和風/森林/櫻花/星夜）× 深淺模式切換
- PWA 離線模式 — Service Worker + NetworkFirst 快取 + 離線 Toast 通知
- Day Map 互動地圖 — Google Maps 嵌入 + 動線連線 + 多天總覽（`?showmap=1`）
- Tailwind CSS v4 Blue-Green 升級基礎建設 — tokens.css + V1/V2 路由切換
- Admin V2 cutover — 第一個全 Tailwind inline 頁面上線
- QuickPanel Bottom Sheet — 替代 Speed Dial 的快捷面板
- InfoSheet 手機版 multi-detent — 半版/滿版手勢切換
- Tripline 品牌重塑 — 手寫風 SVG logo + `/trip/{id}` URL routing
- Loading Skeleton 骨架屏 — shimmer 動畫 + fade-in 過渡
- 毛玻璃材質 — StickyNav + InfoSheet + QuickPanel backdrop blur
- 旅伴請求四態 stepper（open → received → processing → completed）
- 每日問題報告系統（daily-check + Telegram 通知）
- Staging CI/CD — PR CI pipeline + SW 驗證
- D1 備份腳本（dump-d1.js）+ 備份納入版控

### Changed
- Manage/Admin 頁面加入 Cloudflare Access 401/403 redirect
- `?trip=` query string 相容舊版 URL，自動轉為 React Router 路由
- 匯出功能重寫 — 完整行程資料 + 5 個附屬文件
- 「建議」改名為「解籤」+「問事情」廟宇問事風格

### Fixed
- PUT /days/:num 遺漏 source、mapcode、location_json 欄位
- Admin V2 cutover 修復 10 項 — stale closure、AbortController、Content-Type、401 redirect 防護
- SPA manage/admin CSS hotfix 循環（22 個 PR）→ Blue-Green 策略根治
- shared.css 刪除 187 行 dead admin-* CSS
- workbox build Browserslist 錯誤（根目錄 shell wrapper 誤讀）
- entries PATCH/DELETE D1 error handling
- 四層 UTF-8 encoding 防堵 — curl 亂碼根治
- SW navigateFallbackDenylist 排除 Access 保護頁面

### Removed
- Vanilla JS 入口（app.js、manage.js、admin.js）— 改由 React 接管
- dist/ 從版控移除 — 由 Cloudflare Pages build
- Tunnel/Agent Server 殘留程式碼
- V1 AdminPage + V1/V2 比對 E2E tests

## [0.x] - 2026-02 ~ 2026-03-17

### Added
- Cloudflare D1 資料庫 — trips/days/entries/restaurants/shopping/trip_docs/audit_log/requests/permissions
- Cloudflare Pages Functions API — 完整 CRUD + audit trail + rollback
- 旅伴請求系統（requests API + ManagePage）
- 權限管理系統（permissions API + AdminPage）
- 設定頁（SettingPage）— 主題切換 + 深淺模式 + 字體大小
- 全站 inline SVG icon（Material Symbols Rounded）
- CSS HIG 設計規範（12 條）+ 自動測試守護
- Markdown 行程檔 → D1 遷移腳本

## [0.0] - 2026-02-01

### Added
- Initial commit — 靜態 HTML 沖繩五日自駕遊行程表
- Markdown 行程檔格式
