## Phase 1 — Tier 0 Bug Fix（PR #200，merge commit a66942d，v2.0.1.1）

### F001：Icon.tsx 補 edit / menu SVG
- [x] F001.1 red test：`<Icon name="edit">` / `<Icon name="menu">` 應 render svg 且含 `<path>`（`tests/unit/icon-edit-menu.test.ts`）
- [x] F001.2 green fix：`ICONS` map 加 `edit`（鉛筆 SVG，stroke 1.75px）+ `menu`（三橫線 SVG，stroke 1.75px）；刪重複且未使用的 `pencil` entry（commit `a66942d`）

### F002：砍 topbar 三個 dead tab
- [x] F002.1 red test：render TripPage 後 DOM 不應出現「路線 / 航班 / AI 建議」三個 tab button（`tests/unit/topbar-dead-tabs.test.ts`）
- [x] F002.2 green fix：TripPage.tsx / DayNav.tsx 拿掉 topbar tab bar 的三個 onClick-less 按鈕（commit `a66942d`）

### F003：AdminPage 移除 × 改 TriplineLogo Link
- [x] F003.1 red test：`/admin` route render 後不應有 `×` close 按鈕；TriplineLogo 應渲染 `<a href="/">`（`tests/unit/admin-page.test.ts`）
- [x] F003.2 green fix：`PageNav.onClose` 改 optional，AdminPage 省略 `onClose`；`TriplineLogo` 統一改 `<Link to="/">`（commit `a66942d`）

### F004：非整數 font-size 全改整數 px
- [x] F004.1 red test：CSS 中不應出現 `9.5px`、`10.5px`、`11.5px`、`13.3333px`（`tests/unit/no-fractional-fontsize.test.ts`）
- [x] F004.2 green fix：DayNav eyebrow 9.5px→10px、day-chip area 11.5px→11px、hero eyebrow 10.5px→10px、InfoBox heading 10.5px→10px、Manage hero eyebrow 10.5px→10px（commit `a66942d`）
- [x] F004.3 refactor：確認所有 `em` 繼承路徑，改用 px 明確值（commit `a66942d`）

### F005：InfoSheet default 改關閉
- [x] F005.1 red test：RTL mount TripPage 後 InfoSheet `data-sheet-open` 應為 false（`tests/unit/trip-page-sheet-default.test.ts`）
- [x] F005.2 green fix：TripPage.tsx `activeSheet` 初始值改 `null`（commit `a66942d`）

### F006：MobileBottomNav 確認 5 個 tab 全有 icon
- [x] F006.1 red test：5 個 tab 全應 render `<svg>`，不允許 iconSize=null（`tests/unit/mobile-bottom-nav-entries.test.ts`）
- [x] F006.2 green fix：確認補完 F001 後所有 tab icon 正常 render（commit `a66942d`）

### F007：TriplineLogo 全頁 Link
- [x] F007.1 red test：ManagePage / AdminPage / TripPage 左上 logo 應 render `<a href="/">`（`tests/unit/tripline-logo-link.test.ts`）
- [x] F007.2 green fix：`TriplineLogo` 統一改 `<Link to="/">`（commit `a66942d`）

### F008：Dev infra — vite.config.ts leaflet optimizeDeps
- [x] F008.1 green fix（non-TDD，infra）：`vite.config.ts` 加 `optimizeDeps.include: ['leaflet']`，解決 pull 後 dev server 無法 resolve leaflet 的 CJS/ESM race（commit `a66942d`）

---

## Phase 2 — Typography + Material Consistency（PR #201，merge commit 0ad5af7，v2.0.1.2）

### F009：DESIGN.md 新增 Mobile Type Scale section
- [x] F009.1 red test：`DESIGN.md` 應含 `## Type Scale (Mobile ≤760px)` section，含 body 16px、callout 15px、subheadline 14px 等欄位（`tests/unit/pr2-tokens.test.ts` / `design-md-sections.test.ts`）
- [x] F009.2 green fix：DESIGN.md 新增完整 mobile type scale 表格，760px 斷點理由（tablet ≥768px 維持 desktop scale）（commit `0ad5af7`）

### F010：tokens.css 補 `--font-size-eyebrow` + `--blur-glass`
- [x] F010.1 red test：tokens.css 應含 `--font-size-eyebrow: 0.625rem` 與 `--blur-glass: 14px` 宣告（`tests/unit/pr2-tokens.test.ts`）
- [x] F010.2 green fix：`tokens.css` 加入兩個 token 宣告（commit `0ad5af7`）

### F011：Glass 全面統一 14px，移除 saturate(1.8)
- [x] F011.1 red test：CSS 不得出現 `blur(12px)` / `blur(28px)` / `saturate(1.8)`（`tests/unit/pr2-tokens.test.ts`）
- [x] F011.2 green fix：`.ocean-topbar`、`.ocean-bottom-nav`、`InfoSheet` 全部改用 `backdrop-filter: blur(var(--blur-glass))`；sheet 拿掉 `saturate(1.8)`；bg opacity 88%→94%（commit `0ad5af7`）

### F012：AI 編輯 pill 改 Ocean fill
- [x] F012.1 red test：AI pill 的 `:hover` / `:focus-visible` / `:active` state 應存在（`tests/unit/pr2-tokens.test.ts`）
- [x] F012.2 green fix：AI pill 從黑底 + cyan dot 改 Ocean accent 填色 + 白字，補 hover/focus-visible/active 三 state（commit `0ad5af7`）

### F013：注意事項卡 destructive → warning amber
- [x] F013.1 red test：注意事項卡 CSS 不應出現 `#C13515`（`tests/unit/pr2-tokens.test.ts`）
- [x] F013.2 green fix：`#C13515` 紅 → `#F48C06` warning amber（commit `0ad5af7`）

### F014：Stop card title 確認 17px
- [x] F014.1 red test：stop card title CSS font-size 應為 17px（headline，DESIGN.md §3.3）（`tests/unit/pr2-mobile-scale.test.ts`）
- [x] F014.2 green（已符合）：PR 1 已對齊，本 PR 加測試守住（commit `0ad5af7`）

### F015：Hardcode 10/11px 全面 token 化
- [x] F015.1 red test：`tokens.css`、`DayNav`、`InfoBox` 等 CSS 不應出現 hardcode `font-size: 10px` / `11px`（`tests/unit/pr2-mobile-scale.test.ts`）
- [x] F015.2 green fix：所有 10px/11px 改 `var(--font-size-eyebrow)` / `var(--font-size-caption2)`（commit `0ad5af7`）

### F016：DESIGN.md Data Visualization 例外條文
- [x] F016.1 red test：`DESIGN.md` Color section 應含 DV 例外條文，允許 10 色 qualitative palette（`tests/unit/design-md-sections.test.ts`）
- [x] F016.2 green fix：DESIGN.md 加 Data Visualization 例外 section（commit `0ad5af7`）

### F017：底部 nav 按鈕 tap target 修正
- [x] F017.1 red test：`.ocean-bottom-nav-btn` padding + `min-height: 44px`（Apple HIG）（`tests/unit/pr2-tokens.test.ts`）
- [x] F017.2 green fix：padding 10px → 13px + `min-height: 44px`（commit `0ad5af7`）

---

## Phase 3 — IA 重構 + Desktop Map Rail（PR #202，merge commit 1d26886，v2.0.2.0）

### F018：MobileBottomNav 5 tab → 4 tab route-based
- [x] F018.1 red test：bottom nav tab count 應為 4；active 判斷用 `useLocation().pathname` + 嚴格 regex，不誤觸 `/manage/map-xxx`（`tests/unit/mobile-bottom-nav-route.test.ts`）
- [x] F018.2 green fix：4 tab（行程 / 地圖 / 訊息 / 更多）；地圖 tab → `navigate('/trip/:id/map')`；CSS `grid-template-columns` 5fr → 4fr（commit `1d26886`）

### F019：TripMapRail 新 component（≥1024px sticky map）
- [x] F019.1 red test：TripPage ≥1024px media 應 render `TripMapRail`（`tests/unit/trip-map-rail-visibility.test.ts`）
- [x] F019.2 red test：TripMapRail 點 pin 後 `navigate('/trip/:id/stop/:entryId')` 被呼叫（`tests/unit/trip-map-rail-focus.test.ts`）
- [x] F019.3 green fix：新增 `TripMapRail.tsx`，Leaflet 地圖高度 `calc(100dvh - nav-h)`，全行程 pins + 每天不同色 polyline（commit `1d26886`）

### F020：dayPalette.ts（10 色 qualitative palette）
- [x] F020.1 red test：10 色輪流、modulo wrap、0/負數/NaN/Infinity fallback day 1 色（`tests/unit/dayPalette.test.ts`，10 色 + guard 測試）
- [x] F020.2 green fix：`src/lib/dayPalette.ts`，Tailwind sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald -500（commit `1d26886`）

### F021：Desktop sidebar 刪除
- [x] F021.1 red test：TripPage ≥1024px render 不應出現 `.trip-sidebar`（`tests/unit/trip-map-rail-visibility.test.ts`）
- [x] F021.2 green fix：拿掉 sidebar progress / 今日行程 / 住宿三張小卡（commit `1d26886`）

### F022：DaySection 拿掉 inline OceanMap，加「看地圖」chip
- [x] F022.1 red test：DaySection render 不應含 `<OceanMap mode="overview">`（`tests/unit/no-inline-day-map.test.ts`）
- [x] F022.2 red test：DaySection eyebrow 右側應有「看地圖」link，href 含 `/map?day=`（`tests/unit/day-section-map-link.test.ts`）
- [x] F022.3 green fix：拿掉 inline map；加「看地圖」chip 導向 `/trip/:id/map?day=N`（commit `1d26886`）

### F023：MapPage 讀 `day` query param fitBounds
- [x] F023.1 red test：MapPage 帶 `?day=2` 應 fitBounds 到第 2 天 pins（`tests/unit/map-page-day-query.test.ts`）
- [x] F023.2 green fix：MapPage 讀 `useSearchParams().get('day')`，呼叫 `fitBounds` 對應天 pins（commit `1d26886`）

### F024：useMediaQuery hook（SSR safe）
- [x] F024.1 green fix：`src/hooks/useMediaQuery.ts`，同步讀 `window.matchMedia`，SSR 安全（commit `1d26886`）

### F025：useLeafletMap.fitBounds single-pin NaN zoom guard
- [x] F025.1 red test：`getZoom()` 回 NaN 時 fitBounds 不應 throw（`tests/unit/useLeafletMap-nan-zoom.test.ts`）
- [x] F025.2 green fix：加 `Number.isFinite(z)` guard（commit `1d26886`）

### F026：Desktop OverflowMenu 補 3 個 sheet 入口
- [x] F026.1 green fix：今日路線 / AI 建議 / 航班 sheet 入口加回 OverflowMenu（補 PR 1 tech debt）（commit `1d26886`）

### F027：TripPage.tsx 清理 topbar tab bar container
- [x] F027.1 green fix：PR 1 砍 button，PR 3 清 container shell；body render 不再依賴 `activeTripId` selector race，直接用 `trip.id`（commit `1d26886`）

---

## 完成狀態

全部 27 個 feature / fix 項目已完成，測試總數 370 → **469**，`npx tsc --noEmit` 0 errors，prod 已部署至 https://trip-planner-dby.pages.dev/。
