## 1. Typography token sweep

- [x] 1.1 改 `css/tokens.css` `--font-size-body` 從 `1.0625rem` (17px) 改 `1rem` (16px)
- [x] 1.2 改 `css/tokens.css` `--font-size-footnote` 從 `0.8125rem` (13px) 改 `0.875rem` (14px)
- [x] 1.3 改 `css/tokens.css` `.tp-titlebar-title` desktop hardcoded 24px 改用 `var(--font-size-title3)` (20px)
- [x] 1.4 改 `css/tokens.css` `.tp-titlebar-title` compact 22px 改 18px
- [x] 1.5 改 `css/tokens.css` `.ocean-hero-title` 三段 breakpoint：base 28→24、≥961 32→28、≤960 28→24
- [x] 1.6 加 `css/tokens.css` `@media (max-width: 760px) :root { --font-size-title: 1.5rem; }` 讓 page-title compact 降 24px
- [x] 1.7 改 `src/pages/TripsListPage.tsx` `.tp-trip-card-eyebrow` font-size eyebrow / 0.12em
- [x] 1.8 改 `src/pages/TripsListPage.tsx` `.tp-trip-card-title` font-size body / lh 1.35 / 2-line clamp

## 2. NewTripModal SVG close + weight

- [x] 2.1 改 `src/components/trip/NewTripModal.tsx` `.tp-new-form-close` 內容從「✕」字元改 `<Icon name="x-mark" />`
- [x] 2.2 改 NewTripModal `.tp-new-modal h2` font-weight 800 → 700

## 3. TripsList camelCase + 出發日 + 已歸檔

- [x] 3.1 改 `src/pages/TripsListPage.tsx` TripInfo interface 從 snake_case 改 camelCase + 加 archivedAt 欄位
- [x] 3.2 改 cardMeta 加 `startDateMD` helper 顯示「7/2 出發」格式
- [x] 3.3 改 `t.day_count` → `t.dayCount` (eyebrow 渲染) + sortBy 'start' 改 startDate
- [x] 3.4 改 filterTab type 加 'archived' + visibleTrips filter 邏輯（archived 取 archivedAt!=null，其他排除 archivedAt）
- [x] 3.5 改 tabCounts 加 archived count
- [x] 3.6 加第 4 顆 filter tab「已歸檔」
- [x] 3.7 加 archived empty state 文案「目前沒有已歸檔行程」+ 「回到全部」reset button

## 4. AddStopModal region selector + filter + 文案

- [x] 4.1 改 `src/components/trip/AddStopModal.tsx` 加 `defaultRegion?: string` prop + REGION_OPTIONS hardcode list
- [x] 4.2 加 region pill state + dropdown JSX 在 search tab body 上方
- [x] 4.3 加 filter button JSX trailing search input + filter sheet placeholder
- [x] 4.4 改 footer counter 文案：即使 totalSelected===0 也顯示「已選 0 個 · 將加入 ...」
- [x] 4.5 改 modal title font-weight 800 → 700
- [x] 4.6 加 region-pill / region-menu / filter-btn / filter-sheet CSS
- [x] 4.7 改 `.tp-add-stop-search-input` padding-right 100px 給 filter button 留空間

## 5. TripPage dayLabel 全大寫格式

- [x] 5.1 改 `src/pages/TripPage.tsx` AddStopModal dayLabel 從「Day {N} · {date}」改「DAY {NN} · {M}/{D}（{星期}）」格式

## 6. /map page entry cards + FAB position

- [x] 6.1 改 `src/pages/GlobalMapPage.tsx` 移除 `.tp-global-map-mobile-stack` 的 `@media (max-width: 1023px)` gate，改為 `display: block` 跨 viewport
- [x] 6.2 加 `.tp-map-entry-stack` / `.tp-map-entry-cards` / `.tp-map-entry-card` class alias 對齊 mockup 命名
- [x] 6.3 改 `.tp-global-map-actions` 從 `top: 76px; left: 16px` 改 `right: 16px; bottom: 116px` FAB 位置

## 7. Mobile bottom nav label 字級

- [x] 7.1 改 `src/components/shell/GlobalBottomNav.tsx` `.tp-global-bottom-nav-btn span` 字級從 11px/500 改 11px/14px/700

## 8. Icon registry 補 icon

- [x] 8.1 加 `src/components/shared/Icon.tsx` 4 個新 icon：`chevron-down` / `chevron-up` / `filter` / `target`

## 9. Documentation

- [x] 9.1 改 `DESIGN.md` type scale 章節：補 mockup type scale 對應 token 表（v2 deeper QA finding 後增的 letter-spacing 0.12em / line-height 細項）
- [x] 9.2 改 `CHANGELOG.md` 加 v2.16.4（or 2.17.0）release note entry

## 10. Tests + ship

- [x] 10.1 加 `tests/unit/mockup-typography-compliance.test.ts` 用 raw text grep 驗證 11 element / SVG icon spec（避開 vitest jsdom + Tailwind 4 @theme 整合不穩問題）
- [ ] 10.2 加 `tests/unit/modal-close-button-svg.test.tsx` 驗證 NewTripModal / AddStopModal close 含 `<svg>`
- [ ] 10.3 加 `tests/unit/trips-list-card-meta.test.tsx` 驗證 eyebrow + meta 出發日格式
- [ ] 10.4 加 `tests/unit/trips-list-archived-filter.test.tsx` 驗證 archived filter empty state
- [ ] 10.5 加 `tests/unit/add-stop-modal-region-pill.test.tsx` 驗證 region pill render + dropdown
- [x] 10.6 跑 `bun run typecheck` (clean) + `bun test tests/unit/pr2-tokens` (23/23 pass) + `bun test tests/unit/mockup-typography-compliance` (11/11 pass)
- [ ] 10.7 commit + push + PR 含 before/after evidence
