> **Source of truth**：`docs/design-sessions/terracotta-preview-v2.html`。每個 task 對齊 mockup section + design.md decision；衝突以 mockup 為準。所有 React component 變更走 TDD red→green→refactor。

## 1. Phase A — Token + Component primitives（無 page 動作）

- [ ] 1.1 grep `tokens.css` 確認 `--radius-full` 是否存在；若無，補 `--radius-full: 9999px` token + 文件註解
- [ ] 1.2 grep src/ 找出所有 `border-radius: 999px` / `9999px` hardcoded，替換成 `var(--radius-full)`（保留 `border-radius: 50%` 圓形例外）
- [ ] 1.3 補 `tokens.css` 加 map marker shadow exception variable + loading shimmer animation keyframe（對應 mockup `.tp-map-marker.is-active` + `tp-map-shimmer`）
- [ ] 1.4 紅燈：寫 `tests/unit/title-bar.test.tsx`，斷言 `<TitleBar title="X" />` 渲染 sticky chrome、無 eyebrow / meta；`<TitleBar back={...} />` 顯示左側返回；`<TitleBar actions={[...]} />` 渲染右側 actions 並符合 44px 觸控
- [ ] 1.5 綠燈：新建 `src/components/shell/TitleBar.tsx` 對齊 mockup chrome（sticky + glass blur 14px + hairline border-bottom + desktop 64px / compact 56px）
- [ ] 1.6 在 `src/components/shell/PageHeader.tsx` 加 `export { TitleBar as default } from './TitleBar'` re-export shim（暫存以便 phase B-D 漸進切換；Phase E cleanup 移除）
- [ ] 1.7 紅燈：寫 `tests/unit/map-day-tab.test.tsx` 斷言 idle / active 樣式、dayColor inline、min-height 44px、border-bottom transparent → accent
- [ ] 1.8 綠燈：新建 `src/components/trip/MapDayTab.tsx`
- [ ] 1.9 紅燈：寫 `tests/unit/map-entry-card.test.tsx` 斷言 type icon mapping (hotel/food/sight/shopping)、day-local index、active state ring + accent icon
- [ ] 1.10 綠燈：新建 `src/components/trip/MapEntryCard.tsx`
- [ ] 1.11 跑 `npx tsc --noEmit` + `npm test` 確認 Phase A 全綠
- [ ] 1.12 commit：`refactor(shell): TitleBar + MapDayTab + MapEntryCard primitives (Phase A)`

## 2. Phase B — Map page + OceanMap

- [ ] 2.1 紅燈：寫 `tests/unit/ocean-map-marker-no-emoji.test.tsx` render OceanMap with hotel pin → 斷言 marker label === `String(pin.index)`，不含 `🛏` 或任何 emoji 字元
- [ ] 2.2 綠燈：改 `src/components/trip/OceanMap.tsx:63` `markerIcon` 函式 → `const label = String(pin.index);`（移除 hotel 三元）
- [ ] 2.3 綠燈：刪 `src/components/trip/OceanMap.tsx:110` `.ocean-map-pin[data-type="hotel"] { font-size: 14px; }` CSS（emoji 專用 override）
- [ ] 2.4 紅燈：擴 `tests/unit/ocean-map-imperative-effects.test.tsx` 斷言 idle marker 套 dayColor border + dayColor color、active marker 套 accent fill + accent ring（對齊 mockup `.tp-map-marker` / `.tp-map-marker.is-active` 規格）
- [ ] 2.5 綠燈：改 `OceanMap.tsx` SCOPED_STYLES 的 `.ocean-map-pin` idle 樣式為 dayColor border + dayColor text（用 `data-day-color` 或 inline style）；active 維持既有 accent fill
- [ ] 2.6 跑既有 `tests/unit/ocean-map-*.test.tsx`、`map-page-*.test.tsx` 全綠
- [ ] 2.7 commit：`refactor(map): OceanMap marker no emoji + dayColor idle (Phase B-1)`
- [ ] 2.8 紅燈：寫 `tests/unit/map-page-layout.test.tsx` 斷言 MapPage 渲染含 TitleBar (`title="地圖"`) + map canvas (flex-1) + MapDayTab nav + MapEntryCard list；overview tab 第一項為「總覽 · {N}天」
- [ ] 2.9 綠燈：改 `src/pages/MapPage.tsx` 用新 TitleBar + MapDayTab + MapEntryCard 重組 layout（保留既有 URL state 解析 / dayQuery / focus 邏輯）
- [ ] 2.10 紅燈：寫 `tests/unit/map-page-loading-empty.test.tsx` 斷言 loading 顯示 spinner + 「地圖載入中…」+ aria-busy；empty 顯示 glass card + i-map icon + 「此日尚無景點」
- [ ] 2.11 綠燈：MapPage 加 loading + empty branch
- [ ] 2.12 紅燈：寫 `tests/e2e/map-bottom-tabs.spec.ts` 走 Playwright：點 Day 02 tab → URL `?day=2` + map markers 切換 + entry cards row 重設 day-local index
- [ ] 2.13 綠燈：補 MapPage URL ↔ active tab 雙向 sync
- [ ] 2.14 跑 `npm test` + `npm run test:api` + `npx playwright test map-bottom-tabs` 全綠
- [ ] 2.15 commit：`refactor(map): MapPage layout + loading/empty (Phase B-2)`

## 3. Phase C — TripList + TripDetail + AddStopModal

- [ ] 3.1 紅燈：寫 `tests/unit/trips-list-page-titlebar.test.tsx` 斷言桌機 actions 為「搜尋 + 新增 `+`」、手機只「新增 `+`」、無 eyebrow
- [ ] 3.2 綠燈：改 `src/pages/TripsListPage.tsx` titlebar 換成 TitleBar API + 對映 actions
- [ ] 3.3 紅燈：寫 `tests/unit/trip-list-card.test.tsx` 斷言 entry card 視覺對齊 mockup Section 18（含 dayColor accent / 行程名 / 時間 / 狀態 chip）
- [ ] 3.4 綠燈：refactor TripsListPage entry card 樣式對齊 mockup
- [ ] 3.5 commit：`refactor(trips): TripsListPage titlebar + cards (Phase C-1)`
- [ ] 3.6 紅燈：寫 `tests/unit/trip-detail-titlebar.test.tsx` 斷言桌機右側「建議 + 共編 + 下載 + 更多 ⋯」、手機右側「更多 ⋯」+ 左側返回
- [ ] 3.7 綠燈：改 `src/pages/TripPage.tsx` titlebar
- [ ] 3.8 紅燈：寫 `tests/unit/trip-detail-day-nav.test.tsx` 斷言 DayNav sticky + scroll-direction hide-on-scroll
- [ ] 3.9 綠燈：改 TripPage DayNav scroll behavior（共用 AppShell scroll direction state）
- [ ] 3.10 commit：`refactor(trip): TripPage titlebar + DayNav sticky (Phase C-2)`
- [ ] 3.11 紅燈：寫 `tests/unit/add-stop-modal.test.tsx` 斷言對齊 mockup Section 16（搜尋 / 收藏 / Custom 三 tab、結果列表）
- [ ] 3.12 綠燈：改 AddStopModal layout
- [ ] 3.13 跑 `npm test` 全綠
- [ ] 3.14 commit：`refactor(trip): AddStopModal layout (Phase C-3)`

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

- [ ] 5.1 grep `import.*PageHeader` 確認所有 import 已切到 TitleBar；移除 PageHeader.tsx re-export shim
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
