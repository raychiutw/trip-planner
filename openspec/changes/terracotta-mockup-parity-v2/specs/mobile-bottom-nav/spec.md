## ADDED Requirements

> **Decision (2026-04-28)**: Adopt **5-tab** IA — 對齊 mockup section 02 source
> of truth。詳見 `notes/bottom-nav-ia-decision.md` + `notes/e-deferred-decisions.md`
> §E4。本 spec 取代既有 `openspec/specs/mobile-bottom-nav.md` 4-tab spec。
> 4-tab BottomNavBar 實作 deprecated；全 page 統一用 `<GlobalBottomNav>`。
> 配合「active trip context」機制 (`src/contexts/ActiveTripContext.tsx`) 補償
> in-trip workflow 退步。

### Requirement: Bottom Nav IA 5-tab vs 4-tab decision（**product gate**）

對應 mockup section 02 (line 5152-5238) vs React 既有 4-tab IA（archive change `2026-04-21-design-review-v2-retrofit`）的根本差異。

兩種 IA 對比：

| Aspect | Mockup 5-tab global | React 4-tab trip-scoped |
|---|---|---|
| Tab 1 | 聊天 (chat list) | 行程 (current trip) |
| Tab 2 | 行程 (trips list) | 地圖 (current trip map) |
| Tab 3 | 地圖 (global map) | 助理 (chat for current trip) |
| Tab 4 | 探索 | 更多 (action sheet) |
| Tab 5 | 帳號 | — |
| Mental model | App-level global 切換 | Trip-level scoped + global escape via「更多」 |
| 切 trip | 透過 chat list / trips tab | TripPickerSheet (action sheet 內) |

決策題：mockup 是 trip-planner 應該成為 global app（每 tab 切 page）還是維持 trip-scoped（user 開 trip 後 4 tab 都跟當前 trip 互動）？

#### Scenario: Decision 跑 office-hours / plan-ceo-review 收斂
- **WHEN** 本 capability implement task 啟動
- **THEN** 第一 task 是 invoke `/office-hours` 或 `/plan-ceo-review` 走 forcing question discussion
- **AND** 輸出 decision doc 到 `openspec/changes/terracotta-mockup-parity-v2/notes/bottom-nav-ia-decision.md`
- **AND** Decision 含：選擇方向（5-tab / 4-tab / hybrid）+ rationale + impact on existing trip-scoped UX

#### Scenario: Decision = 5-tab adopt
- **WHEN** Decision 結果是 adopt 5-tab IA
- **THEN** 後續 task 解鎖：實作 BottomNavBar.tsx 5-tab + 各 tab page entry 對接 + 拿掉「更多」action sheet pattern + 影響範圍評估

#### Scenario: Decision = keep 4-tab
- **WHEN** Decision 結果是維持 4-tab IA
- **THEN** 後續 task 不解鎖；本 capability 收尾為「decision 紀錄」 + mockup section 02 標 deviation accepted
- **AND** mobile-bottom-nav existing spec 不變

#### Scenario: Decision = hybrid
- **WHEN** Decision 結果是 hybrid（如：登入後 5-tab，trip 內切回 trip-scoped 4-tab）
- **THEN** 解鎖 hybrid 實作 task：context-aware nav + 路徑判斷 + 視覺切換 indicator

### Requirement: Mobile Bottom Nav 5-tab IA（conditional on §Decision）

**前置條件**：§Decision 結果為「5-tab adopt」才解鎖實作。否則本 requirement 標 N/A。

修改 `src/components/shell/BottomNavBar.tsx`：

| index | label | icon | onClick | active 判斷 |
|---|---|---|---|---|
| 0 | 聊天 | `chat` | `navigate('/chat')` | `pathname.startsWith('/chat')` |
| 1 | 行程 | `home` | `navigate('/trips')` | `pathname.startsWith('/trips')` 或 `pathname.startsWith('/trip/')` |
| 2 | 地圖 | `map` | `navigate('/map')` | `pathname.startsWith('/map')` 或 `pathname.startsWith('/trip/') && pathname.endsWith('/map')` |
| 3 | 探索 | `search` | `navigate('/explore')` | `pathname.startsWith('/explore')` |
| 4 | 帳號 | `user` | `navigate('/account')` | `pathname.startsWith('/account')` |

設計規範（沿用既有 + 對齊 mockup）：
- CSS grid `repeat(5, 1fr)`
- 每 tab：icon (18×18 SVG) + label (`var(--font-size-caption2)` 11px / weight 700 對齊 mockup)
- 觸控目標 `min-height: 44px`
- Active 樣式：accent-subtle 底 + 2px top indicator (`border-top: 2px solid var(--color-accent)`) + accent text
- Background：`rgba(255,255,255,0.97)` + `backdrop-filter: blur(var(--blur-glass))`
- Border-top：1px `var(--color-border)`

「更多」action sheet pattern 移除（內含的 collab / trip-select / appearance / export 等功能改去：collab → trip detail TitleBar、trip-select → 「行程」tab 內 picker、appearance → AccountPage「外觀設定」row、export → trip detail TitleBar OverflowMenu）。

#### Scenario: 5-tab 顯示 + active 切換
- **WHEN** mobile (≤760px) user load app
- **THEN** Bottom nav 顯示 5 個 tab：聊天 / 行程 / 地圖 / 探索 / 帳號
- **AND** 當前 pathname 對應的 tab active（accent-subtle 底 + 2px top indicator）

#### Scenario: 「行程」tab 對 trip detail page active
- **WHEN** user 在 `/trip/okinawa-2026`
- **THEN** Bottom nav「行程」tab active

#### Scenario: 「地圖」tab regex 不誤觸
- **WHEN** user 在 `/manage/map-xxx`
- **THEN** Bottom nav「地圖」tab **不** active（regex 嚴格 `/^\/(map$|trip\/[^/]+\/map$)/`）

### Requirement: Active trip context 機制（補償 5-tab 失去 trip-scoped 高效）

對應 E4 決策的額外需求。新建 `src/contexts/ActiveTripContext.tsx` 為 single
source of truth，所有 global route (/chat /map /explore) 預設帶入當前 active
trip 對應內容。

實作規範：
- React Context provider 包在 app root (`<ActiveTripProvider>` 在 BrowserRouter
  內 NewTripProvider 之外)
- localStorage `LS_KEY_TRIP_PREF` 持久化 (繼承既有 key，不需 migration)
- Window `storage` event subscribe → 跨 tab 同步
- `useActiveTrip()` hook 讀寫
- TripPage 進入時自動 `setActiveTrip(activeTripId)`
- ChatPage / GlobalMapPage / ExplorePage 讀 `activeTripId` 預設

每頁整合：
| 頁 | 預設行為 |
|---|---|
| /chat | trip picker 預選 active trip 對應 chat thread |
| /map | active trip 對應的 map pin overview (GlobalMapPage 既有) |
| /explore | region pill 預設 active trip's countries 對應 (JP→沖繩 / KR→首爾 / TW→台北) |

#### Scenario: 進入 /trip/:id 自動 set active trip
- **WHEN** user 進入 `/trip/okinawa-2026`
- **THEN** `ActiveTripContext.activeTripId === 'okinawa-2026'`
- **AND** localStorage `tp-trip-pref` 持久化

#### Scenario: 切到 /chat 預設 active trip 對應 thread
- **WHEN** user 在 `/trip/okinawa-2026` 點底部「聊天」 tab
- **THEN** 切到 /chat，trip picker 自動選 'okinawa-2026'
- **AND** History fetch `/api/requests?tripId=okinawa-2026`

#### Scenario: 切到 /map 預設 active trip 對應 map
- **WHEN** user 在 `/trip/okinawa-2026` 點底部「地圖」 tab
- **THEN** 切到 /map (GlobalMapPage)，預設選 'okinawa-2026'
- **AND** Map pin 顯示 okinawa-2026 行程的 POI

#### Scenario: 跨 tab 同步
- **WHEN** user 在 tab A setActiveTrip('kyoto')
- **AND** Tab B 同 app open
- **THEN** Tab B 的 activeTripId state 自動更新為 'kyoto' (storage event)
