## ADDED Requirements

### Requirement: DesktopSidebar 顯示 5 個 top-level nav
桌機 `<DesktopSidebar>` SHALL 顯示下列 5 個 nav items，依序：
1. 聊天 → `/chat`
2. 行程 → `/manage`
3. 地圖 → `/map`
4. 探索 → `/explore`
5. 登入 / 帳號 → `/login`（已登入時顯示帳號 chip，未登入顯示「登入」）

每 item 高度 48px，包含 icon 20px + label 14px，padding-left 14px。

#### Scenario: 未登入使用者看到 sidebar
- **WHEN** 未登入使用者（無 session cookie）訪問任何 AppShell 頁面
- **THEN** sidebar 最後一 item 顯示「登入」+ icon
- **AND** 點擊導到 `/login`

#### Scenario: 已登入使用者看到 sidebar
- **WHEN** 已登入使用者訪問 AppShell 頁面
- **THEN** sidebar 最後一 item 顯示使用者 avatar + email（縮寫）
- **AND** 點擊開 account popover（登出 / 設定）

### Requirement: Sidebar 顯示當前 active nav 視覺
當前路由對應的 nav item SHALL 有 active state 視覺（背景 highlight 或左邊框 accent），未 active 的 nav item 保持 muted。

#### Scenario: 使用者在 /manage 頁
- **WHEN** 當前路由 `/manage`
- **THEN** 「行程」nav item 顯示 active state（背景 `var(--color-accent-subtle)` 或對應 token）
- **AND** 其他 4 個 nav items 為 muted inactive style

#### Scenario: 使用者在 /trip/:id 頁
- **WHEN** 當前路由 `/trip/okinawa-trip-2026-Ray` 或其他 trip
- **THEN** 「行程」nav item 同樣 active（因為 trip 是行程 sub-route）

### Requirement: Sidebar 底部 New Trip CTA
Sidebar bottom SHALL 顯示一個「+ 新行程」primary button（full-width pill-shape），點擊觸發 Create Trip modal（Phase 2 時 modal 未實作，可先 navigate to `/trip/new` placeholder）。

#### Scenario: 點 New Trip CTA
- **WHEN** 使用者點 sidebar bottom 的「+ 新行程」button
- **THEN** 觸發 Create Trip modal（Phase 2 未實作時顯示 coming-soon toast）
- **AND** 未來（Phase 3+）開啟 Mindtrip-style "Where to?" modal

### Requirement: Sidebar 寬度 240px 且 sticky
Sidebar SHALL 寬度 fixed 240px，height 100vh，`position: sticky; top: 0`。桌機 `≥ 1024px` 顯示；`< 1024px` 完全隱藏（替換為 bottom nav）。

#### Scenario: 桌機 breakpoint
- **WHEN** viewport width ≥ 1024px
- **THEN** sidebar 顯示，寬 240px，main content 從 240px 開始

#### Scenario: 手機 breakpoint
- **WHEN** viewport width < 1024px
- **THEN** sidebar 不顯示（display: none）
- **AND** main content 佔滿全寬

### Requirement: Sidebar icon 使用現有 `<Icon>` 系統
Sidebar 的 5 個 nav icon SHALL 使用 `src/components/shared/Icon.tsx` 的 inline SVG 系統，不引入第三方 icon library（遵守 tp-claude-design 的 override §7d）。

#### Scenario: 新增 icon
- **WHEN** 需要新 icon（例「探索」的指南針 icon 若系統不存）
- **THEN** 在 `src/components/shared/Icon.tsx` 新增 SVG path
- **AND** 不 import lucide-react / heroicons / tabler-icons
