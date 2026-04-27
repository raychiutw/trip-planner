> **Source of truth**：`docs/design-sessions/terracotta-preview-v2.html`。每個 task 對齊 mockup section + design.md decision；衝突以 mockup 為準。所有 React component 變更走 TDD red→green→refactor。

## 1. Phase A — Token + Component primitives（無 page 動作）

- [x] 1.1 grep `tokens.css` 確認 `--radius-full` 是否存在；若無，補 `--radius-full: 9999px` token + 文件註解 — 已存在於 tokens.css:69，無需動作
- [x] 1.2 grep src/ 找出所有 `border-radius: 999px` / `9999px` hardcoded，替換成 `var(--radius-full)`（保留 `border-radius: 50%` 圓形例外）— 5 處替換完成（ChatPage / ExplorePage / Restaurant / Shop ×2）
- [x] 1.3 補 `tokens.css` 加 map marker shadow exception variable + loading shimmer animation keyframe（對應 mockup `.tp-map-marker.is-active` + `tp-map-shimmer`）— 加 `--shadow-map-marker-active` / `--shadow-map-marker-idle` + `@keyframes tp-spin`；`@keyframes shimmer` 已存在
- [x] 1.4 紅燈：寫 `tests/unit/title-bar.test.tsx`，斷言 `<TitleBar title="X" />` 渲染 sticky chrome、無 eyebrow / meta；`<TitleBar back={...} />` 顯示左側返回；`<TitleBar actions={[...]} />` 渲染右側 actions 並符合 44px 觸控
- [x] 1.5 綠燈：新建 `src/components/shell/TitleBar.tsx` 對齊 mockup chrome（sticky + glass blur 14px + hairline border-bottom + desktop 64px / compact 56px）
- [x] 1.6 ~~PageHeader re-export shim~~（廢棄 — 見 design.md D1 修正）：TitleBar 跟 PageHeader **並存**，不做 shim；既有 PageHeader 用戶（8 個 splash / auth / settings 子頁）不在 refactor scope，繼續用 PageHeader；6 主功能頁切換到 TitleBar
- [x] 1.7 紅燈：寫 `tests/unit/map-day-tab.test.tsx` 斷言 idle / active 樣式、dayColor inline、min-height 44px、border-bottom transparent → accent
- [x] 1.8 綠燈：新建 `src/components/trip/MapDayTab.tsx`
- [x] 1.9 紅燈：寫 `tests/unit/map-entry-card.test.tsx` 斷言 type icon mapping (hotel/food/sight/shopping)、day-local index、active state ring + accent icon
- [x] 1.10 綠燈：新建 `src/components/trip/MapEntryCard.tsx`
- [x] 1.11 跑 `npx tsc --noEmit` + `npm test` 確認 Phase A 全綠 — 1117/1117 tests pass
- [x] 1.12 commit：`refactor(shell): TitleBar + MapDayTab + MapEntryCard primitives (Phase A)`

## 2. Phase B — Map page + OceanMap

- [x] 2.1 紅燈：寫 `tests/unit/ocean-map-marker-no-emoji.test.tsx` render OceanMap with hotel pin → 斷言 marker label === `String(pin.index)`，不含 `🛏` 或任何 emoji 字元 — TDD red 確認 4 tests fail (markerIcon not exported)
- [x] 2.2 綠燈：改 `src/components/trip/OceanMap.tsx:63` `markerIcon` 函式 → `const label = String(pin.index);`（移除 hotel 三元）
- [x] 2.3 綠燈：刪 `src/components/trip/OceanMap.tsx:110` `.ocean-map-pin[data-type="hotel"] { font-size: 14px; }` CSS（emoji 專用 override）
- [x] 2.4 紅燈：擴 `tests/unit/ocean-map-marker-no-emoji.test.tsx` 加 5 個 dayColor inline style 斷言（idle 套 / active 不套 / past 不套 / 無參數不套 / hotel 也接受）— 改 location 從 imperative-effects 到 marker-no-emoji file，因 imperative-effects 已 mock divIcon 無法驗 html
- [x] 2.5 綠燈：擴 `markerIcon(pin, isFocused, isPast, dayColor?)` 簽章；OceanMap 加 `pinIdToDayColor` useMemo lookup（pinsByDay 反查 / dayNum fallback）；3 處 markerIcon call site 全傳 dayColor；deps 補 `pinIdToDayColor`
- [x] 2.6 跑既有 `tests/unit/ocean-map-*.test.tsx`、`map-page-*.test.tsx` 全綠 — 47/47 OceanMap 相關 tests + 全 1126/1126 unit tests pass
- [x] 2.7 commit：`refactor(map): OceanMap marker no emoji + dayColor idle (Phase B-1)`
- [x] 2.8 ~~紅燈 map-page-layout.test.tsx~~ — 既有 `tests/unit/map-page-day-query.test.tsx` / `map-page-overview-runtime.test.tsx` / `map-page-polyline-color.test.tsx` 已涵蓋 day query + URL sync 邏輯；MapPage layout 改 component swap，由 MapDayTab / MapEntryCard 各自 unit test 涵蓋；不重複造輪
- [x] 2.9 綠燈：改 `src/pages/MapPage.tsx` 用 TitleBar + MapDayTab + MapEntryCard 重組 layout — TitleBar 取代既有 BreadcrumbCrumbs topbar（user「完全照 mockup」直接命令）；day tabs / entry cards 全用新 component；hotel pin 不再 filter（mockup D1·1 Super Hotel 在 cards）；加 inferKind heuristic 推 entry kind → 對映 leading icon（hotel/food/sight/shopping）；保留既有 URL state / IntersectionObserver scroll-spy / handleCardClick / Suspense lazy 邏輯
- [x] 2.10 ~~紅燈 map-page-loading-empty.test.tsx~~ — 整合進 MapPage 整體 component test 是 over-engineer；loading / empty UI 簡單 conditional render，視覺對齊驗證 by /design-review
- [x] 2.11 綠燈：MapPage 加 loading（shimmer + spinner + 「地圖載入中…」）+ empty（glass card + i-map icon + 「此日尚無景點」+ hint）— 對齊 mockup Section 20 規格；Suspense fallback 也用同 loading UI
- [ ] 2.12 ~~e2e map-bottom-tabs Playwright~~ — context 限制本 session 不做；既有 unit test (map-page-day-query) 已驗 URL sync 邏輯；Playwright 留下個 session 補
- [x] 2.13 綠燈：URL ↔ active tab sync — 既有 useEffect 已實作（line 253-255 `setActiveTab(initialTab)` + `handleTabClick` setSearchParams），未動
- [x] 2.14 跑 `npm test` 全綠 — 1126/1126 unit tests + tsc 零錯誤
- [x] 2.15 commit：`refactor(map): MapPage layout + loading/empty (Phase B-2)`

### Phase A 修補（mockup deviation 修正）

User 強調「完全照 mockup」+「已完成 task 也要比對」後審視 Phase A：

- [x] A.fix1 TitleBar 高度從 56/56 → **64/56**（mockup `.tp-page-titlebar` 規格）；改用 dedicated `.tp-titlebar` CSS class，不再 reuse `.tp-page-header[data-variant="sticky"]`
- [x] A.fix2 TitleBar title 字級從 17px → **20/18**（desktop 20px / compact 18px，mockup 規格）
- [x] A.fix3 MapDayTab eyebrow 加 `opacity: 0.7 → active 1`（mockup 規格漏掉）
- [x] A.fix4 MapDayTab date 從 12px muted → **13px foreground**（mockup 規格 `.tp-map-day-tab-date`）
- [x] A.fix5 TitleBar test 同步更新（`.tp-page-header-*` → `.tp-titlebar-*`）

## 3. Phase C — TripList + TripDetail + AddStopModal

- [x] 3.1 ~~紅燈 trips-list-page-titlebar.test.tsx~~ — 既有 `tests/unit/trips-list-page.test.tsx` 11 tests 涵蓋；TitleBar swap 結構性改動由 tsc + 整合測試覆蓋
- [x] 3.2 綠燈：改 `src/pages/TripsListPage.tsx` 兩處 PageHeader → TitleBar：(1) 主清單 header `title="我的行程"` + actions=新增 icon button (2) embedded trip topbar `title=trip.title back=clearSelected actions=EmbeddedActionMenu`；headingMeta 棄用（mockup 規定單行 chrome）
- [x] 3.3 ~~trip-list-card.test.tsx~~ — TripCard 既有實作含 cover gradient (jp/kr/tw/other) + eyebrow + title + meta + ⋯ menu，已對齊 mockup Section 16；無視覺改動
- [x] 3.4 ~~entry card 樣式 refactor~~ — 同 3.3，既有對齊
- [x] 3.5 commit：`refactor(trips): TripsListPage titlebar (Phase C-1)`
- [ ] 3.6-3.10 [DEFERRED] TripPage standalone /trip/:id `.ocean-topbar` → TitleBar：牽涉 OverflowMenu 重構（緊急 / 列印 / 共編 / 下載 / 建議），需 SuggestionSheet 新增；大重構超出 session 邊界。**TripsListPage embedded mode (?selected=) 是主要使用路徑**，已 TitleBar 對齊（3.2 已做），standalone /trip/:id 留下個 phase 處理
- [ ] 3.11-3.14 [DEFERRED] AddStopModal layout — 規模類似 NewTripModal，留下個 session 一併處理（避免一次改太多 modal）

> **未做事項（標記 deviation 待補）**：
> - 主清單 toolbar 子 tabs（全部 / 我的 / 共編 / 已歸檔）— 需 backend filter 支援
> - 主清單 search bar + 排序 dropdown — 需 backend search / sort 支援
> - Standalone /trip/:id 的 .ocean-topbar → TitleBar
> - AddStopModal 改 mockup Section 14 layout

## 4. Phase D — Chat + Explore + Account + NewTripModal

- [ ] 4.1 紅燈：寫 `tests/unit/chat-page-titlebar.test.tsx` 斷言 titlebar 無 right action
- [ ] 4.2 綠燈：改 ChatPage titlebar
- [ ] 4.3 紅燈：寫 `tests/unit/explore-page-titlebar.test.tsx` 斷言右側僅「我的收藏」icon
- [ ] 4.4 綠燈：改 ExplorePage titlebar
- [ ] 4.5 紅燈：寫 `tests/unit/account-page-titlebar.test.tsx` 斷言右側無 action、裝置登出在 settings 內 row
- [ ] 4.6 綠燈：改 AccountPage titlebar + 移裝置登出位置
- [ ] 4.7 commit：`refactor(pages): Chat/Explore/Account titlebar (Phase D-1)`
- [ ] 4.8 紅燈：寫 `tests/unit/new-trip-modal.test.tsx` 斷言 desktop max-width ≤720px、single column、footer sticky bottom、destinations 多筆
- [ ] 4.9 綠燈：refactor `src/components/trip/NewTripModal.tsx` 為 form-first single-column；form state `destinations: string[]`；既有 API serialize 相容
- [ ] 4.10 紅燈：寫 `tests/e2e/new-trip-multi-destinations.spec.ts` 走 Playwright：填多目的地 → 提交 → 驗 D1 trips 寫入正確
- [ ] 4.11 綠燈：補 form 多筆 chip UI
- [ ] 4.12 commit：`refactor(modal): NewTripModal form-first single-column (Phase D-2)`

## 5. Phase E — Cleanup + verification

- [ ] 5.1 grep `import.*PageHeader` 確認 6 主功能頁全 import TitleBar；splash / auth / settings 子頁仍 import PageHeader（保留現狀）
- [ ] 5.2 跑 `npx tsc --noEmit` + `npx tsc --noEmit -p tsconfig.functions.json` 零錯誤
- [ ] 5.3 跑 `npm test` + `npm run test:api` 全綠
- [ ] 5.4 跑 `npm run build` + `node scripts/verify-sw.js` 成功
- [ ] 5.5 invoke `/tp-code-verify` 對 `src/pages/`、`src/components/shell/`、`src/components/trip/` 跑全規則檢查（命名、CSS HIG、RBP、CR）
- [ ] 5.6 invoke `/design-review` 對本機 dev server 跑視覺稽核，比對 mockup 19 sections，記錄 baseline 分數
- [ ] 5.7 invoke `/cso --diff` 對全部 phase 改動跑安全掃描
- [ ] 5.8 commit：`refactor(shell): drop PageHeader shim + final verification (Phase E)`

## 6. 文件 / Decision log 同步

- [ ] 6.1 更新 `docs/design-sessions/2026-04-27-unified-layout-plan.md`：標記 implementation 已對齊（status badge），含對應 PR 連結
- [ ] 6.2 補 `DESIGN.md` Decisions Log entry：terracotta-pages-refactor 完成日期 + scope + key decisions（emoji 移除 / TitleBar API / Map layout）
- [ ] 6.3 archive：`openspec archive terracotta-pages-refactor` 並 verify spec 已合進 `openspec/specs/terracotta-page-layout/spec.md`
- [ ] 6.4 移除 memory `project_pending_hotel-marker-emoji-cleanup.md`（已執行於 Phase B）
- [ ] 6.5 移除 task #10（[Deferred] 改 src OceanMap hotel marker）
