## Context

trip-planner 既有 layout（`TripPage`、`ManagePage` 各自自行排版）重構成統一的 `<AppShell>`，以支援 Phase 3+ 所需的 sidebar / right sheet / bottom nav。Layout refactor doc 已 lock：

- 桌機 3-pane：sidebar 240px + main fluid + right sheet 40vw collapsible
- 手機 bottom nav 5 tab 常駐
- Breakpoint：`≥1280px` 3-pane full / `1024-1279` 3-pane narrow / `<1024` mobile

## Goals / Non-Goals

**Goals:**
- 建立 `<AppShell>` wrapper，所有 authenticated route 套用
- 桌機顯示 `<DesktopSidebar>` with 5 nav
- 手機 `<BottomNavBar>` 常駐（不 hide on scroll）
- Grid template 定義在 `tokens.css` 讓各 page 不重刻
- 新增 `/chat` `/map` `/explore` `/login` 空頁面（Phase 3+ 填內容）
- Phase 2 ship 時不讓使用者覺得「東西壞了」— TripPage 的 map rail 改成 sheet slot 顯示「sheet 功能建置中」placeholder 或在 Phase 2.5 同步 Phase 3

**Non-Goals:**
- 不實作 Sheet 內部 tabs（Phase 3 才做）
- 不 implement Explore / Saved 功能（Phase 4）
- 不改 AI chat / manage / admin 邏輯（只套殼）
- 不做 V2 OAuth（`/login` 是空 placeholder 含「使用現有 CF Access 登入」提示）

## Decisions

### 1. AppShell 用 CSS Grid 而非 Flexbox
**為何**：3-pane 需固定寬度 column（sidebar 240 / sheet 40vw），fluid middle。Grid template 簡潔一行定義；Flexbox 要 min-width / max-width 多條規則。Grid template 亦方便 responsive：手機改 1-col grid 只要改 grid-template-columns。
**備選**：Flexbox — 可行但 verbose。Tailwind CSS 4 with grid utilities 是 nice fit（既有 stack）。

### 2. MobileBottomNav 用 `position: sticky; bottom: 0` 不 fixed
**為何**：sticky 在 scroll container 下自然跟 content，fixed 會永遠在 viewport 導致觸發 iOS safe area 補正陷阱多。Sticky + `inset-block-end: 0` 配合 main content 的 `padding-bottom: 88px` 保留高度即可。
**備選**：`position: fixed` — 傳統但需手動處理 iOS notch / safe-area-inset-bottom。

### 3. DesktopSidebar sticky 不 scroll with main
**為何**：Mindtrip pattern — sidebar 永遠在同位置，只有 main 內容滾。便於 quick nav 切換。
**實作**：`position: sticky; top: 0; height: 100vh` 配合 `<AppShell>` 的 grid layout。

### 4. 右 sheet slot Phase 2 暫 null，Phase 3 緊接 ship
**為何**：Phase 2 單獨 ship 的話，使用者會發現 map rail 消失 → 負面 UX。方案：Phase 2 + Phase 3 合並成 "layout + sheet" single release，或 Phase 2 ship 時 map rail 改為 sheet slot 裡 render 既有 `<TripMapRail>`（過渡方案）。
**備選**：Phase 2 feature flag 開/關 sidebar — 複雜度超過收益，拒絕。建議過渡方案：Phase 2 的 sheet slot 先 render 既有 MapRail，Phase 3 才換 TripSheet with tabs。

### 5. Sidebar 5 nav routing 用 `<NavLink>` from react-router-dom
**為何**：react-router-dom 既有 dependency，`<NavLink>` 自動 active state class。無需自刻。
**備選**：手刻 with `useLocation` — 多寫不必要的邏輯。

### 6. `/login` placeholder 顯示 CF Access 提示
**為何**：V2 OAuth 還沒 ship，現在點「登入」nav 要導到哪？設計成 `/login` page 顯示「使用 Cloudflare Access 登入」+ CTA button，按下 redirect to `/manage`（CF Access 會擋 + 走既有登入流）。V2 OAuth ship 時此 page 改為真 login form。
**備選**：暫時 hide 「登入」nav — Q2 lock 說 5 個 nav 必有登入，拒絕。

## Risks / Trade-offs

- **[Risk] 套 AppShell 造成既有 TripPage / ManagePage 破版** → Mitigation: 每 page refactor 前先寫 screenshot snapshot test + /design-review check
- **[Risk] Phase 2 ship 時右 map rail 消失 → 使用者投訴** → Mitigation: 見 Decision 4，用過渡方案（sheet slot 暫 render MapRail），Phase 3 緊接 replace 成 TripSheet
- **[Risk] tokens.css grid template variable naming clash** → Mitigation: 前綴 `--grid-` + 跟既有 variable 雙 check
- **[Risk] MobileBottomNav sticky 在 iOS safari 有 bug（sticky + dynamic viewport）** → Mitigation: 寫 Playwright E2E test 在 iOS webkit engine 驗證
- **[Trade-off] 新增 5 個 placeholder page 增加 bundle size** → impact ~5KB total (each page ~1KB stub)，可接受

## Migration Plan

1. **Week 3 Day 1-2**：tokens.css 加 grid template + 寫 AppShell / DesktopSidebar snapshot test（failing）
2. **Week 3 Day 3-4**：implement AppShell + DesktopSidebar + BottomNavBar 改常駐
3. **Week 3 Day 5**：refactor TripPage / ManagePage 套殼，sheet slot 暫 render MapRail 過渡
4. **Week 4 Day 1-2**：加 5 個 placeholder page + router 新增 route
5. **Week 4 Day 3-4**：`/design-review` + Playwright E2E 驗證 iOS + 桌機 breakpoint
6. **Week 4 Day 5**：走 `/tp-team` + ship staging + prod
7. **Rollback**：revert commits；AppShell 若 break 全 layout，revert 一次就回穩

## Open Questions

- Phase 2 + Phase 3 要不要合成單一 release？Decision 4 建議合；若合，Phase 2 tasks.md 結尾直接接 Phase 3 任務不另 ship
- Sidebar collapse 按鈕要 Phase 2 做還是後期？建議後期（不 critical path）
- `<DesktopSidebar>` 的 Create trip button 放哪裡？Mindtrip 有 「New chat」CTA 在 sidebar bottom — trip-planner 對應「+ 新行程」，建議同位置
