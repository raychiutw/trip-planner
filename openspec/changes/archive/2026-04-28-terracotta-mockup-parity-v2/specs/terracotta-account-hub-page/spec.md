## ADDED Requirements

### Requirement: 新建 `/account` route + `AccountPage.tsx` 統一帳號 hub

對應 mockup section 19 (line 7425-7583)。本 page 是既有分散在 `/settings/sessions` `/settings/connected-apps` `/settings/developer-apps` 的 settings entry hub，加 profile hero 與分組 settings rows，提供 mockup 規範的 unified 帳號管理介面。

Page 元件結構（自上而下）：
1. TitleBar 標題「帳號」+ 既有 back chevron pattern
2. **Profile hero** 區塊：
   - Avatar 64x64px（沿用既有 sidebar account chip avatar 邏輯，無自設 avatar 時用 user email 第一字母 + accent 背景）
   - Name（DEV_MOCK_EMAIL 或 user.email）
   - Email 文案
   - 3 stats row：「N 個行程 / N 天旅程 / N 位旅伴」
3. Settings rows 3 group（每 group 一個 `<section>` 含 `<h2>` group label + N 個 row）：
   - **應用程式**：外觀設定 / 通知設定
   - **共編 & 整合**：已連結 App / 開發者選項
   - **帳號**：已登入裝置 / 登出 (destructive)

每個 row 元件：left icon (圓形 box，accent-subtle 背景) + center title + helper text + right chevron。Click → navigate 對應 page，或 destructive 走 confirm dialog。

#### Scenario: Logged-in user 訪問 /account
- **WHEN** logged-in user 訪問 `/account`
- **THEN** 顯示 TitleBar「帳號」+ Profile hero（avatar / name / email / 3 stats）+ 3 group settings rows
- **AND** 7 個 row 全部可點擊（navigate 或 destructive）
- **AND** Page 呼叫 `useRequireAuth` 強制登入

#### Scenario: 未登入訪問 /account
- **WHEN** unauth user 訪問 `/account`
- **THEN** redirect 到 `/login?redirect_after=/account`

#### Scenario: 點「已連結 App」row
- **WHEN** 使用者點「已連結 App」row
- **THEN** navigate `/settings/connected-apps`（既有 `ConnectedAppsPage.tsx`）

#### Scenario: 點「已登入裝置」row
- **WHEN** 使用者點「已登入裝置」row
- **THEN** navigate `/settings/sessions`（既有 `SessionsPage.tsx`）

#### Scenario: 點「開發者選項」row
- **WHEN** 使用者點「開發者選項」row
- **THEN** navigate `/settings/developer-apps`（既有 `DeveloperAppsPage.tsx`）

#### Scenario: 點「外觀設定」row
- **WHEN** 使用者點「外觀設定」row
- **THEN** navigate `/account/appearance`（新建 minimal `AppearanceSettingsPage.tsx`，內容 = 既有 sidebar `<ThemeToggle>` 移到 page level）

#### Scenario: 點「通知設定」row
- **WHEN** 使用者點「通知設定」row
- **THEN** navigate `/account/notifications`（新建 minimal `NotificationsSettingsPage.tsx` stub，初版內容「目前通知功能尚在開發中」+ 之後 polish）

#### Scenario: 點「登出」destructive row
- **WHEN** 使用者點「登出」row
- **THEN** 顯示 confirm dialog「確認登出？」+「取消」/「登出」button
- **AND** 確認後 POST `/api/oauth/logout` 清 session cookie + navigate `/login`
- **AND** 此 row 視覺對齊 mockup `tp-account-row.is-danger`（destructive 紅色）

### Requirement: Profile hero 3 stats 由新 endpoint `/api/account/stats` 提供

新建 `functions/api/account/stats.ts` GET endpoint，aggregate 用 SQL SUM/COUNT 一次 query 回傳：

```typescript
{ tripCount: number, totalDays: number, collaboratorCount: number }
```

避免 client-side N+1 fetch。需 auth；無 trip 時三個值為 0。

#### Scenario: 有 3 個 trip 的 user 取 stats
- **WHEN** logged-in user 已建 3 個 trip 共 18 天 + 5 個其他 collaborator
- **THEN** GET `/api/account/stats` return `{ tripCount: 3, totalDays: 18, collaboratorCount: 5 }`
- **AND** AccountPage profile hero 顯示「3 個行程 / 18 天旅程 / 5 位旅伴」

#### Scenario: 新 user 無 trip
- **WHEN** logged-in user 還沒建任何 trip
- **THEN** GET `/api/account/stats` return `{ tripCount: 0, totalDays: 0, collaboratorCount: 0 }`
- **AND** AccountPage 顯示「0 個行程 / 0 天旅程 / 0 位旅伴」

### Requirement: DesktopSidebar 加「帳號」nav item

對應 mockup section 01 IA「聊天/行程/地圖/探索/帳號」第 5 項。

修改 `src/components/shell/DesktopSidebar.tsx`：
- 既有 logged-in 隱藏「登入」slot 改為 「帳號」item，icon `user`，target `/account`
- Logged-out 仍顯示「登入」item
- Sidebar 底部既有 user account chip 保留（因為 hover state 顯示 email 仍有用），但 click 改 navigate `/account`（之前 click 不動）

#### Scenario: Logged-in user 看 sidebar
- **WHEN** logged-in user load app
- **THEN** sidebar 顯示 5 個 nav item：聊天 / 行程 / 地圖 / 探索 / 帳號
- **AND**「帳號」item icon = user，active 判斷 `pathname.startsWith('/account')`

#### Scenario: 點底部 user chip
- **WHEN** logged-in user 點底部 sidebar account chip
- **THEN** navigate `/account`
