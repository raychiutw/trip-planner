## Why

Mindtrip Layout benchmark locked 桌機 3-pane（sidebar + main + right sheet）+ 手機 bottom nav 常駐，為 sidebar 5 nav（聊天/行程/地圖/探索/登入）提供容器。trip-planner 現狀無 sidebar（桌機是左 timeline + 右 map rail 2-col），也沒統一 `<AppShell>` layout wrapper — 每頁各自排版。

此 Phase 建立 layout 骨架，讓 Phase 3-5（query param state / 探索 / drag）有地方 plug-in。

## What Changes

- **新增 `<AppShell>` component**（`src/components/shell/AppShell.tsx`）— 包 `<DesktopSidebar>` + `<main>` + right sheet slot（可 null 若頁面不需 sheet），加 `<MobileBottomNav>`
- **新增 `<DesktopSidebar>` component**（`src/components/shell/DesktopSidebar.tsx`）— 5 nav items: 聊天 / 行程 / 地圖 / 探索 / 登入，sticky position 寬度 240px
- **修改 `<MobileBottomNav>` 常駐 pattern** — 移除任何 hide-on-scroll 邏輯，永遠 visible，main content `padding-bottom: 88px`
- **`<TripPage>` / `<ManagePage>` refactor** 套入 AppShell，右 map rail 暫以 null sheet slot 取代（Phase 3 改 TripSheet with tabs）
- **tokens.css 新增 3-pane grid template** `--grid-3pane-desktop: 240px 1fr min(780px, 40vw)`
- **Route 新增 `/chat` / `/map` / `/explore` / `/login` placeholder page**（route exists for nav but content coming in later phases）

## Capabilities

### New Capabilities

- `app-shell-layout`: 統一 layout wrapper，桌機 3-pane（breakpoint ≥ 1024px）+ 手機 bottom nav 常駐 + 共用 header，所有 authenticated route 套用
- `desktop-sidebar`: 桌機左側 240px sidebar，5 個 top-level nav items，sticky position，active state 視覺，兼顧 collapse 可能性

### Modified Capabilities

（無既有 sidebar spec；mobile bottom nav 目前行為改變在 app-shell-layout 新 spec 內定義）

## Impact

- **新 files**：
  - `src/components/shell/AppShell.tsx`
  - `src/components/shell/DesktopSidebar.tsx`
  - `src/components/shell/BottomNavBar.tsx`（若現有 `MobileBottomNav` 需重寫則 replace）
  - `src/pages/ChatPage.tsx`（placeholder for Phase 3+）
  - `src/pages/MapPage.tsx`（現有 map page 若存 move 到 shell 內）
  - `src/pages/ExplorePage.tsx`（placeholder for Phase 4）
  - `src/pages/LoginPage.tsx`（placeholder for V2 OAuth）
- **修改 files**：
  - `src/pages/TripPage.tsx` — 套 AppShell
  - `src/pages/ManagePage.tsx` — 套 AppShell
  - `src/entries/main.tsx` — router 新增 `/chat` `/map` `/explore` `/login` routes
  - `css/tokens.css` — 新 grid template variable
- **Breakpoint 策略**：`≥1280px` 3-pane full；`1024-1279` 3-pane with narrower sheet；`<1024` 單欄 + mobile bottom nav
- **相依**：不依賴 V2 OAuth（`/login` 現為 placeholder），可 parallel
- **Breaking 變化**：右 map rail UI **暫時不 visible**（sheet slot null until Phase 3 refactor）— 必須 document user-facing regression，需在 Phase 2.5 ship 時有 feature flag 或 Phase 3 緊接 ship
