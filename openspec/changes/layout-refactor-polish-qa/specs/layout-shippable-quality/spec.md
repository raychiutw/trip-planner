## ADDED Requirements

### Requirement: 所有 Phase 2-5 新增 page / component 需含 error boundary
每個 top-level page（ChatPage, ManagePage, TripPage, MapPage, ExplorePage, LoginPage, AdminPage）SHALL 用 `<ErrorBoundary>` wrap，fallback UI 顯示錯誤訊息 + 「返回首頁」CTA + 自動 Sentry report。

#### Scenario: Page component throw error
- **WHEN** ExplorePage 渲染期 throw error（如 API response 格式錯）
- **THEN** ErrorBoundary catch + 顯示 fallback UI
- **AND** Sentry receive error with page context
- **AND** App 其他部分（sidebar, nav）仍正常運作

### Requirement: Sheet / modal 有開關 animation
Phase 2-5 新增的 TripSheet open/close、modal enter/exit SHALL 有 CSS transition（200ms ease-in-out），且尊重 `prefers-reduced-motion` media query（使用者偏好減少動畫時 transition 改 0ms instant）。

#### Scenario: 使用者開啟 TripSheet
- **WHEN** 使用者點 sheet trigger
- **THEN** sheet 從右滑入 200ms ease-in-out
- **AND** main content grid shrink 同步動畫

#### Scenario: 使用者 prefers-reduced-motion
- **WHEN** 瀏覽器 `prefers-reduced-motion: reduce`
- **THEN** sheet 開關 instant 無動畫
- **AND** 使用者不 perceive motion

### Requirement: Lighthouse CI 80+ performance, 90+ accessibility
每 PR SHALL run lighthouse-ci against 主要 page（`/manage`, `/trip/:id`, `/explore`）並於 PR comment 貼結果。新 page SHALL ≥ 80 performance score + ≥ 90 accessibility score。Legacy page 若 < 80 為 tech debt 記錄不 block。

#### Scenario: PR 新 page 效能不達標
- **WHEN** ExplorePage lighthouse performance 60
- **THEN** PR CI 標記 failure + comment 指出問題（LCP / CLS / FID）
- **AND** 開發者修完重 push 才能 merge

### Requirement: A11y keyboard navigation 支援所有 interactive
Sidebar, Bottom nav, Sheet tabs, Modal close, Drag-and-drop (Phase 5) SHALL 全支援 keyboard operation（Tab / Shift+Tab / Enter / Space / Esc / Arrow keys）。

#### Scenario: 使用者 Tab 進 sidebar
- **WHEN** 使用者 press Tab
- **THEN** focus 進 sidebar 第一個 nav item
- **AND** 可 Tab 往下逐項 focus
- **AND** Enter 觸發 nav

#### Scenario: 使用者 Esc 關 modal
- **WHEN** modal 開啟
- **THEN** Esc 關 modal + focus 回 modal trigger element

### Requirement: Playwright E2E 覆蓋 Phase 2-5 主要 user journey
CI SHALL 跑 Playwright E2E 包括：
- 桌機 login → 建 trip → 加 ideas → promote → reorder
- 手機 login → explore → save POI → add to trip
- Sheet tab 切換 + URL query param 驗證
- drag-to-promote 4 scenarios
三個 browser engines: Chrome desktop, iOS webkit, Chrome Android mobile viewport。

#### Scenario: Full E2E suite run on main branch
- **WHEN** push 到 main branch
- **THEN** CI 跑 Playwright 3 browser matrix
- **AND** 所有 test 綠才 merge 到 prod deploy branch

#### Scenario: PR 只跑 Chrome desktop
- **WHEN** PR open
- **THEN** CI 跑 Chrome desktop only（降低 CI 時間）
- **AND** main branch 合 PR 後才跑 full matrix

### Requirement: CHANGELOG + DESIGN.md Decisions Log 同步
Phase 6 ship 時 SHALL:
- CHANGELOG.md 加 layout refactor v3 entry（12 週 overview + Phase 2-5 feature list）
- DESIGN.md Decisions Log 加 2026-05-xx entry 紀錄 layout v3 完成
- README.md 更新 layout 結構說明（3-pane / 5 nav / bottom nav）
- 所有文件使用繁體中文台灣用語

#### Scenario: Ship Phase 6 prod 時
- **WHEN** 使用者走 `/ship` pipeline
- **THEN** PR body 含 CHANGELOG snippet
- **AND** DESIGN.md via `/design-consultation update` 已 merge
- **AND** README 反映新結構
