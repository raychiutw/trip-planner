## 1. Grid tokens + breakpoint

- [x] 1.1 寫 failing test: tokens.css 提供 `--grid-3pane-desktop` variable 值為 `240px 1fr min(780px, 40vw)`
- [x] 1.2 寫 failing test: `--nav-height-mobile` variable 值為 `88px`
- [x] 1.3 在 `css/tokens.css` 新增 `--grid-3pane-desktop`、`--grid-2pane-desktop`（無 sheet 時）、`--nav-height-mobile`
- [x] 1.4 新增 breakpoint convention 註解（1024 / 1280 boundary）

## 2. AppShell component

- [x] 2.1 寫 failing test：`<AppShell>` 桌機 render 3-col grid 當傳 sheet prop
- [x] 2.2 寫 failing test：`<AppShell>` 桌機 render 2-col grid 當不傳 sheet prop
- [x] 2.3 寫 failing test：`<AppShell>` 手機 render 單欄 + bottom nav 且不 render sidebar / sheet
- [x] 2.4 寫 failing test：`<AppShell>` 手機 main content 有 `padding-bottom: 88px`
- [x] 2.5 建 `src/components/shell/AppShell.tsx` 實作
- [x] 2.6 snapshot test 桌機 3-pane / 2-pane / 手機三種 layout

## 3. DesktopSidebar component

- [x] 3.1 寫 failing test：`<DesktopSidebar>` render 5 個 nav items with correct label + href
- [x] 3.2 寫 failing test：當前路由 /manage 時「行程」item 有 active state class
- [x] 3.3 寫 failing test：當前路由 /trip/:id 時「行程」item 仍 active
- [x] 3.4 寫 failing test：未登入顯示「登入」，已登入顯示帳號 chip
- [x] 3.5 寫 failing test：bottom New Trip CTA 點擊觸發 modal（Phase 2 僅觸發 toast）
- [x] 3.6 建 `src/components/shell/DesktopSidebar.tsx` 實作
- [x] 3.7 新增 5 個 nav icon 到 `src/components/shared/Icon.tsx`（若有缺）

## 4. BottomNavBar 常駐改造

- [x] 4.1 寫 failing test：既有 `<MobileBottomNav>` 使用 `position: sticky; inset-block-end: 0`
- [x] 4.2 寫 failing test：樣式含 `padding-bottom: env(safe-area-inset-bottom)`
- [x] 4.3 寫 failing test：滾動時 nav 位置不變（用 jsdom scroll simulation 驗）
- [x] 4.4 若既有有 hide-on-scroll 邏輯，刪除該邏輯
- [x] 4.5 若檔名是 `MobileBottomNav` 統一改 `BottomNavBar` 並 update imports

## 5. Page refactor 套 AppShell

- [x] 5.1 寫 failing test：`<TripPage>` render 於 AppShell 內，sheet slot 傳 `<TripMapRail>`（過渡方案）
- [x] 5.2 寫 failing test：`<ManagePage>` render 於 AppShell 內，sheet slot null
- [x] 5.3 refactor `src/pages/TripPage.tsx` 套 AppShell
- [x] 5.4 refactor `src/pages/ManagePage.tsx` 套 AppShell
- [x] 5.5 既有 layout CSS 從 pages 移出（整合進 AppShell）

## 6. Placeholder pages

- [x] 6.1 建 `src/pages/ChatPage.tsx`（空 placeholder + "Phase 3 實作" 提示）
- [x] 6.2 建 `src/pages/MapPage.tsx`（若既有 `/trip/:id/map` 外的全域 map 不存在，建空 placeholder）
- [x] 6.3 建 `src/pages/ExplorePage.tsx`（空 placeholder + "Phase 4 實作" 提示）
- [x] 6.4 建 `src/pages/LoginPage.tsx`（顯示「使用 Cloudflare Access 登入」CTA + link to `/manage`）
- [x] 6.5 `src/entries/main.tsx` 新增 `/chat` `/map` `/explore` `/login` routes

## 7. 驗證 + ship

- [x] 7.1 所有 unit / integration / E2E 測試綠燈
- [x] 7.2 `npm run typecheck` + `npm run typecheck:functions` 0 error
- [x] 7.3 Playwright E2E：桌機 1440px / 平板 1024px / 手機 375px / iOS Safari bottom nav safe area 驗證
- [x] 7.4 `/design-review` screenshot audit 比對 DESIGN.md + Mindtrip benchmark
- [x] 7.5 `/tp-team` pipeline pass
- [x] 7.6 Staging → prod deploy；若 visual regression flag 需補，先 rollback
