# Design Decisions: PR6 — autoplan A+B Findings

## F001 — TripMapRail 加 `dark` prop

**決策**：在 `TripMapRailProps` 加 `dark?: boolean`，往下傳給 `useLeafletMap({ dark })`；`TripPage.tsx` 傳 `dark={isDark}`。

**Trade-off**：
- 另一方案是在 `TripMapRail` 內部直接讀 `document.body.classList.contains('dark')`，但這破壞了 prop-down 原則且測試困難。
- 選擇 prop-down：清楚的資料流，符合現有 `DestinationArt dark={isDark}` 的慣例。

## F002 — TripMapRail `fitDoneRef` 跨行程 reset

**決策**：在 `TripPage.tsx` 的 `<TripMapRail key={trip.id}>` 加 `key` prop，讓 React 在行程切換時完全重掛 component（包含 `fitDoneRef` 重置）。

**Trade-off**：
- 另一方案是在 `TripMapRail` 內部 `useEffect(() => { fitDoneRef.current = false }, [tripId])`，但這會造成「reset 後地圖先用舊 pins 畫再 fit 新 pins」的閃爍。
- `key={trip.id}` 完全重掛，乾淨且無副作用，Leaflet 也重新初始化，行為可預期。
- 代價：重掛有短暫 unmount/remount，實際上因為 Leaflet map 本來就要重畫，不算額外成本。

## F003 — Mobile Type Scale 真正落地

**決策**：`tokens.css` 的 `@media (max-width: 760px)` 已有 `.ocean-hero-title { font-size: 22px; }`。
DESIGN.md 規定 mobile hero title 24px。
將 22px 改為 24px，讓設計規範落地。

**Trade-off**：
- 22px → 24px 是 2px 差異，視覺影響小但符合規範。
- 補充：`--mobile-font-size-*` CSS tokens 已定義，但 `.ocean-hero-title` 直接寫死 px 而非用 token，本次不重構 token 連結（避免 scope 膨脹）。

## F004 — color-scheme: dark

**決策**：加 `html { color-scheme: light dark; }` 在 `tokens.css` `:root` 區塊之前。

**Trade-off**：
- 方案 A：`html { color-scheme: light dark; }` — 瀏覽器自動根據 `prefers-color-scheme` 切換，無需 JS。最 minimal。
- 方案 B：在 `body.dark` 加 `:root { color-scheme: dark; }` — 綁定 JS class，更精準但需多一個 selector。
- 選擇方案 A：我們已有 JS 管理 `body.dark`，但 `color-scheme` 的用途（scrollbar、form element）不需要這麼精準，讓瀏覽器自動處理最省事。

## F005 — TripMapRail React.lazy

**決策**：`TripPage.tsx` 改 `import TripMapRail` → `const TripMapRail = lazy(() => import(...))`；用 `<Suspense fallback={null}>` 包。

**Trade-off**：
- `fallback={null}` 而非 skeleton：因為 TripMapRail 在 ≥1024px 才顯示，且地圖初始化需要時間，null 比閃爍 skeleton 更好。
- 代價：TypeScript strict mode 需確認 `React.lazy` import 的型別，`.tsx` 的 default export 格式須正確。

## F006 — TripMapRail marker click integration test

**決策**：補充 `fakeMap` 物件含 `on`, `off`, `remove`, `eachLayer`, `getZoom`, `setView`, `fitBounds` 等，讓 `useLeafletMap` mock 回傳 `map: fakeMap`，使 marker click handler 可以被真正執行。

**Trade-off**：
- 真實 Leaflet 在 JSDOM 無法完整運作（需 DOM canvas/SVG support），所以仍是 mock map。
- 但比 `map: null` 好：handler 函式至少被執行，navigate 被 call 的斷言有意義。
- 不使用 Playwright integration test（e2e 成本高），維持 unit 層級但補強 mock。

## F007 — TripMapRail scroll fly-to active day

**決策**：在 `TripMapRail.tsx` 加 IntersectionObserver，觀察 `day-section` DOM elements（透過 `document.querySelectorAll('[data-day]')`），當某天 section 進入 viewport 60%+，call `map.panTo(dayCenter)`。

**Trade-off**：
- `dayCenter` = 該天 pins 的緯度/經度平均值，在 `pins` 已分組的情況下可直接計算。
- 不使用 scroll event（效能差）。
- 邊界條件：fitDoneRef 初始化後才開始監聽，避免搶佔 initial fitBounds。
- 選擇不使用 `flyTo`（有動畫 overshoot），改用 `map.panTo`（smooth, no overshoot）。

## F008 — 10 色 palette 加 color-blind aid

**決策**：新增 `dayPolylineStyle(dayNum)` 函式，奇數天 solid（`dashArray: undefined`），偶數天 dashed（`dashArray: '6,4'`）。

**Trade-off**：
- 另一方案是用 weight 差異（weight 3 vs 4），但視覺差異太小。
- dashArray 在線段交疊時差異最明顯，且完全不改變顏色方案。
- 代價：polyline 視覺稍微有點「設計感」不一致，但比色盲不可用好。

## F009 — MobileBottomNav「訊息」改「助理」

**決策**：tab label `訊息` → `助理`；aria-label 同步；icon 維持 `phone` 不變（icon 庫沒有 `ai` icon，改 icon 需要額外工作，本次不動）。

**Trade-off**：
- label 改名不影響路由邏輯（navigate 仍去 `/manage`）。
- icon 不同步有輕微語意不一致，但比完全錯誤的 label 好。後續可另立 PR 補 icon。

## F010 — 看地圖 chip tap target 44px

**決策**：MAP_CHIP_STYLES 的 `.day-map-chip` 加 `min-height: 44px; display: inline-flex; align-items: center;`。

**Trade-off**：
- 已有 `display: inline-flex; align-items: center;`，只需補 `min-height: 44px`。
- 增高後可能在 hero chips 行內佔空間更多，但 hero chips 用 `flex-wrap: wrap` 可以適應。
- 符合 Apple HIG 44pt 最小 tap target 要求。

## F011 — `map-page-day-query.test.tsx` runtime 化

**決策**：補充 runtime tests，mount `MapPage` 在三種 URL：`?day=2`（valid）、`?day=abc`（invalid，應 fallback to day 1）、`?day=999`（out-of-range，應 fallback to day 1）。

**Trade-off**：
- MapPage 依賴 `useTripContext`，需要 mock `TripContext.Provider`；mock 複雜但可控。
- 保留原有 source-match tests 作為 regression guard（若有人把 `searchParams.get('day')` 刪掉，source-match 先報警）。
- Runtime tests 更有信心，因為驗證的是 `initialDayNum` 的實際值，而非 source 字串存在。
