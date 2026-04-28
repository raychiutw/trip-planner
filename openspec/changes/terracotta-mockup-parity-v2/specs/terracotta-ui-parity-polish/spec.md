## ADDED Requirements

本 capability 集中處理 14 個 page section 的散落 inconsistency / minor missing / extra finding，按 file 分組。每個 sub-section 的 finding 都對應 design.md §Audit 的細節記錄。

### Requirement: DesktopSidebar 視覺對齊 mockup section 01

修改 `src/components/shell/DesktopSidebar.tsx`：

| Finding | Mockup spec | 修改 |
|---|---|---|
| Active state 顏色 | accent 實心 (`background: --color-accent`) | 改 active item bg 從 `var(--color-foreground)` → `var(--color-accent)`，文字 `var(--color-accent-foreground)` |
| Sidebar 整體背景 | `--color-foreground` 深棕底（dark sidebar on cream page） | 改 sidebar bg 從 `var(--color-background)` → `var(--color-foreground)`，inactive item 文字 muted-light |
| Item font-weight | mockup 600 | 改 `.tp-sidebar-item` font-weight 從 500 → 600（active 時不再 escalate，因為已是預設） |
| Account chip name truncation | mockup `name.length > 10 ? slice(0,10)+'…'` | 加 `truncate(name, 10)` JS-level 截字（不只靠 CSS ellipsis） |

#### Scenario: Sidebar 視覺切換為 dark theme
- **WHEN** logged-in user load desktop layout
- **THEN** sidebar 背景 `rgb(42,31,24)` 深棕（var(--color-foreground)）
- **AND** Active nav item 背景 var(--color-accent) terracotta，文字 white
- **AND** Inactive item 文字 var(--color-muted)，hover 文字 var(--color-background)

#### Scenario: 長 user name truncation
- **WHEN** user name 超過 10 字（如「李 Maximilian 鳳梨太郎」12 字）
- **THEN** Account chip 顯示「李 Maximilian …」（slice(0,10) + ellipsis）

### Requirement: NewTripModal 文案 + tabs + 多目的地拖拉

對應 mockup section 03 (line 5238-5626)。修改 `src/components/trip/NewTripModal.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| Modal title | 「新增行程」 | 改 title 從「想去哪裡？」→「新增行程」 |
| 日期 mode tabs label | 「固定日期 / 大概時間」 | 改 tabs 文案從「選日期 / 彈性日期」→「固定日期 / 大概時間」 |
| Section label | 「目的地（可加多筆，拖拉排序）」 | 改 destination section label 加 hint |
| Helper 行 | 「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」 | 加 helper 行在 destination input 下方 |
| Sub-headline | 無 | 拿掉 React extra「先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。」 |

新增多目的地 row 結構（取代現有 chips list）：
- 每 row：grip handle + 編號 (1/2/3...) + name + region label + remove button
- 用 `@dnd-kit/sortable`（既有 dependency）做拖拉重排
- Remove 後重編號

新增推薦 chips block（mockup Frame 2 + Frame 3）：
- 「熱門目的地」chip group：日本 / 韓國 / 台灣 / 沖繩 / 京都 ...
- 「最近搜尋」chip group：localStorage 拉前 5 個
- discoverability + recall 機制：mockup 用 dropdown 分組（熱門 / 最近搜尋 /
  搜尋結果 3 組），本實作改用 input 下方 chip-blocks pattern 達同需求 —
  user 看到熱門 + 最近 quick start 入口，點 chip → 觸發 search debounce 走
  既有 PoiSearchResult flow（不需 cache 完整 POI shape）。兩種 pattern 等價，
  視 implementation footprint 與 mobile 高度受限 trade-off 選 chip-blocks。
- 目的地數量 ≥2 時顯示「分配天數」stepper：每目的地 +/- N 天

#### Scenario: 標題對齊 mockup
- **WHEN** 使用者點「新增行程」 trigger 開啟 modal
- **THEN** Modal title 顯示「新增行程」（不是「想去哪裡？」）

#### Scenario: 多目的地拖拉重排
- **WHEN** 使用者已加 3 個目的地（沖繩 / 京都 / 大阪），grip 拖第 3 個（大阪）到第 1 位
- **THEN** Order 變「大阪 / 沖繩 / 京都」，編號 1/2/3 對應更新
- **AND** 保留每 row 的 region 顯示

#### Scenario: 「分配天數」stepper 顯示條件
- **WHEN** 使用者加 2 個或更多目的地
- **THEN** 顯示分配天數 stepper：每目的地 +/- N 天，總和 = trip.days
- **AND** 1 個目的地時不顯示

### Requirement: DaySection day hero 加 day title 概念

對應 mockup section 10 (line 5904-5935)。修改 `src/components/trip/DaySection.tsx` 跟 data model：

mockup 規範 day hero title 是「美ら海＋古宇利島一日跑」這種 user-facing 主題字串，不只是 `area || 'Day N'` fallback。

需要：
1. D1 schema：`trip_days` table 加 `title` text column (nullable)
2. `mapDay.ts` 更新含 title
3. DaySection hero 渲染 title 優先 → area fallback → 「Day N」最後 fallback
4. （之後 polish）`/api/trips/:id/days/:num` PATCH 支援 day title 編輯

本 capability 只做 1-3，編輯 UI 為 follow-up。

#### Scenario: Day 有 title
- **WHEN** day row `title` 欄位為「美ら海＋古宇利島一日跑」
- **THEN** Day hero h2 顯示「美ら海＋古宇利島一日跑」
- **AND** Area chip「水族館・古宇利」仍 render 在 chips row（meta 用）

#### Scenario: Day 無 title 有 area
- **WHEN** day row `title` 為 null，`area` 為「北谷」
- **THEN** Day hero h2 顯示「北谷」（fallback to area）

#### Scenario: Day 兩者都無
- **WHEN** day row `title` + `area` 都 null
- **THEN** Day hero h2 顯示「Day {dayNum}」

### Requirement: DayNav 對齊 mockup section 11 day chips

修改 `src/components/trip/DayNav.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| eyebrow 格式 | 「DAY 03 · 今天」（中文「今天」`·` 分隔） | 改 eyebrow logic：今天 day 加「· 今天」suffix（取代既有 `<span class="dn-weather">TODAY</span>` 獨立 pill） |
| date 顯示 | mockup「7/29」 | 拿掉 React `<span class="dn-dow">` 週幾英文 extra 元素 |
| area truncation | mockup 無截字 | 拿掉 `max-width: 80px` truncation 限制（或 raise 到 120px） |

#### Scenario: 今天 chip eyebrow 含「· 今天」
- **WHEN** day chip 對應 today
- **THEN** eyebrow text「DAY 03 · 今天」
- **AND** 無獨立 TODAY pill

#### Scenario: 一般 day chip date 簡潔
- **WHEN** day chip 對應 7/30
- **THEN** date 顯示「7/30」
- **AND** 無週幾英文 extra row

### Requirement: TimelineRail 加結構化「說明 / 備註」section + 編輯備註 toolbar button

對應 mockup section 12 + 13。修改 `src/components/trip/TimelineRail.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| Toolbar「編輯備註」button | mockup 有 (line 6078) `tp-rail-actions` 第 4 個 icon | Inline note click-to-edit 已 cover 但缺 toolbar entry — 加一個 pencil icon button 在 toolbar |
| `tp-rail-actions` `window.confirm` | mockup 規定不用 native confirm | Delete 改用 ConfirmModal（既有 component pattern） |
| Grip collapsed 狀態 | mockup hover row 才顯 | `.ocean-rail-grip` 預設 `opacity: 0`，row hover 變 `opacity: 1`（聚焦時也 visible） |

#### Scenario: 點「編輯備註」toolbar button
- **WHEN** 使用者展開 timeline entry 後點 toolbar 鉛筆 icon button
- **THEN** 直接 focus note textarea（同 click note value 行為）

#### Scenario: 刪除 entry 用 ConfirmModal
- **WHEN** 使用者展開 entry 點 trash icon button
- **THEN** 顯示 destructive ConfirmModal「確定刪除「XX」？此操作無法復原」+ 取消/確認 button
- **AND** 不再用 `window.confirm`

#### Scenario: Grip handle hover 才浮現
- **WHEN** Timeline row 未 hover
- **THEN** grip handle `opacity: 0`（不可見但 keyboard-focusable）
- **WHEN** mouse hover row
- **THEN** grip handle `opacity: 1`

### Requirement: TripPage TitleBar 加文字 label + travel pill

對應 mockup section 13。修改 `src/pages/TripPage.tsx` + TimelineRail：

| Finding | Mockup | 修改 |
|---|---|---|
| TitleBar actions | mockup 「建議 / 共編 / 下載」三 ghost button + icon+text combo + 更多 icon button | 改 TripPage actions 從 icon-only 為 ghost button with icon + text label（同 PageHeader pattern） |
| Travel pill | mockup `tp-travel-pill` 「🚗 10 min · 4.2 km」於每兩 stop 之間 | TimelineRail render 兩 entry 間的 travel info pill（資料來源既有 `entry.travel_type/travel_min/travel_desc`） |

#### Scenario: TripPage TitleBar 顯示 label
- **WHEN** 使用者進 trip detail
- **THEN** TitleBar 右側 actions 顯示「建議」+「共編」+「下載」3 個 ghost button (icon + text)，後接 OverflowMenu kebab
- **AND** Mobile (≤760px) collapse 為 icon-only

#### Scenario: 兩 stop 間 travel pill
- **WHEN** 兩個 entry 之間有 `travel_type` + `travel_min` 資料
- **THEN** 中間 render `tp-travel-pill`「🚗 10 min · 4.2 km」（icon + duration + distance）
- **AND** 無 travel data 不 render

### Requirement: TripsListPage 加 search + filter subtabs + sort + owner avatar

對應 mockup section 16。修改 `src/pages/TripsListPage.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| Search bar | mockup desktop 有「搜尋」ghost button + active state expand | 加 search button + expanding search input + result count + `<mark>` highlight |
| Filter subtabs | mockup「全部 / 我的行程 / 共編行程 / 已歸檔」 | 加 4 個 tab subtabs (segmented control) |
| Sort dropdown | mockup「最新編輯 ▾」 | 加 sort dropdown（最新編輯 / 出發日近 / 名稱 a-z） |
| Card meta | mockup 含 owner avatar + name | Card meta 加 owner avatar 32x32 + name |
| Eyebrow 中文化 | mockup「日本 · 12 天」 | 改 eyebrow 從「JAPAN · 12 DAYS」全英文 → 中文「日本 · 12 天」 |
| Empty state 文案 | mockup「還沒有行程 / 建立第一個行程，開始規劃你的下一趟旅程。也可以從探索頁尋找靈感。」 | 對齊 mockup 文案 |

#### Scenario: 搜尋 trip
- **WHEN** 使用者點 search button + type「沖繩」
- **THEN** Trip list filtered + result count「找到 N 個」+ 名字內「沖繩」字 highlight
- **AND** Cancel 收回 search bar

#### Scenario: 切 filter「共編行程」subtab
- **WHEN** 使用者點「共編行程」subtab
- **THEN** Trip list 只剩 user 為 collaborator 不是 owner 的 trip

#### Scenario: 排序「出發日近」
- **WHEN** 使用者選 sort「出發日近」
- **THEN** Trip list 按 `start_date` ascending 排（未開始的最近的最上面）

#### Scenario: 中文 eyebrow
- **WHEN** Render trip card 對應日本 12 天 trip
- **THEN** eyebrow 顯示「日本 · 12 天」

### Requirement: ChatPage 加 day divider + AI avatar + bubble timestamp prefix

對應 mockup section 17。修改 `src/pages/ChatPage.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| Day divider | `tp-chat-day-divider` 在跨日訊息之間 | rowToMessages 邏輯加 day boundary detection，render `<div class="tp-chat-day-divider">2026-04-27</div>` |
| AI avatar | mockup AI message 左側有「AI」 avatar pill | Assistant bubble 加 avatar 32x32 圓形 with「AI」text |
| Bubble timestamp prefix | mockup「Tripline AI · 14:02」 | 改 `tp-chat-msg-time` 加 prefix「Tripline AI · 」for assistant message |
| Conversation header | mockup 顯示 trip name | TitleBar 標題從「聊天」改為當前 trip name（picker pill 隨之收進 dropdown） |
| Send button | mockup icon-only | 改「送出」 text button → icon-only with `<Icon name="send" />`（保留 aria-label「送出」） |

#### Scenario: 跨日訊息間 render day divider
- **WHEN** 同 conversation 兩條 messages 跨日（4/26 23:00 + 4/27 09:00）
- **THEN** 兩條之間 render `<div class="tp-chat-day-divider">2026-04-27（六）</div>`

#### Scenario: AI message bubble 含 avatar + timestamp prefix
- **WHEN** Assistant message render
- **THEN** Bubble 左側 avatar 顯示「AI」text on accent-subtle 背景
- **AND** Timestamp 行顯示「Tripline AI · 14:02」（user message 不加 prefix）

#### Scenario: ChatPage TitleBar 顯示 trip name
- **WHEN** 使用者選定 trip 進 chat
- **THEN** TitleBar 主標題 = trip.name（如「2026 沖繩五日自駕遊行程表」）
- **AND** Trip switcher 改為 TitleBar overflow menu

### Requirement: ExplorePage POI card 加 cover photo + ❤ + ★ rating + region selector + subtabs

對應 mockup section 18 (line 7284-7423)。修改 `src/pages/ExplorePage.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| Card cover | `tp-explore-card-cover` placeholder color tone | Card 上半 100% width 16:9 cover image (POI photo URL or `data-tone` placeholder) |
| ❤ favorite icon | top-right corner | Card overlay 右上角 heart toggle (favorite ≠ saved，是另一概念 — 或合併為 saved 同時是 favorite) |
| ★ rating meta | `★ 4.6 · ¥2,180` | Card meta 加 ★ rating + 價位 ¥ 區間（既有 `googleRating` 對應） |
| TitleBar action | mockup heart icon (line 7294/7370) | 改既有 star icon → heart icon 對齊 mockup |
| Region selector | mockup「沖繩 ▾」 (line 7299/7375) | 加 region selector pill（default 用 user 最近 trip's region） |
| Subtab chips | mockup「為你推薦 / 景點 / 美食 / 住宿 / 購物」(line 7305-7311) | 加 5 個 POI category subtab chips |
| Card hover | accent border + lift shadow | 加 `:hover` accent border + `transform: translateY(-2px)` + shadow-md |
| **Tab pair 結構** | mockup 無「搜尋 / 我的收藏」tab pair (single content area) | 拿掉既有 `.explore-tabs` UI + CSS，改用 TitleBar action button toggle 兩 view（search 為 default，TitleBar「我的收藏」 button click → saved view，TitleBar 變 back button → 切回 search） |
| **Element 順序** | region pill → search bar → subtab chips → grid (line 7298-7312) | 調整既有 search-on-top 順序 → region 在前 |
| **Search placeholder** | mockup「搜尋景點、餐廳、住宿…」(line 7303) | 改既有「搜尋 POI（例：沖繩水族館、首爾燒肉）」對齊 |
| **Grid columns** | mockup desktop 3-col (line 7290) / compact 2-col (line 7366) | grid-template-columns: repeat(2,1fr); @media ≥1024px → repeat(3,1fr) |
| **「儲存池」文案** | 非台灣慣用語，對齊 mockup「我的收藏」(line 7294) | 全 codebase rename 「儲存池」→「我的收藏」(ExplorePage / LoginPage / SignupPage / api.ts comment / unit test / e2e api-mocks / openspec docs) |

#### Scenario: POI card 結構含 cover + heart + rating
- **WHEN** Render POI card
- **THEN** Card 上半 cover image (如無 POI photo URL，用 `data-tone` 預設 8 種顏色 placeholder)
- **AND** 右上 heart icon button（toggle saved）
- **AND** Card meta「★ 4.6 · ¥2,180」（無 rating 隱藏 ★ 區）

#### Scenario: 切 subtab「美食」
- **WHEN** 使用者點 subtab「美食」chip
- **THEN** POI search 重 fetch with category=`restaurant` filter
- **AND** Grid 重 render

#### Scenario: 切 region
- **WHEN** 使用者點 region selector「沖繩 ▾」+ 選「京都」
- **THEN** POI search 重 fetch with region=`京都`
- **AND** Region selector label 更新「京都 ▾」

#### Scenario: TitleBar「我的收藏」 button toggle 兩 view
- **WHEN** 使用者在預設 search view，點 TitleBar 右上「我的收藏」 heart icon button
- **THEN** 切到 saved view，TitleBar title 變「我的收藏」+ 左上出現 back button「返回探索」
- **AND** Search 相關 UI (region pill / search bar / subtab) 隱藏，改 render saved POI grid
- **WHEN** 使用者點 back button
- **THEN** 切回 search view，TitleBar 復原「探索」 + 「我的收藏」 button

#### Scenario: ExplorePage 「我的收藏」 仍保留 multi-select + 加入行程 modal
- **WHEN** 使用者在 saved view 多選 POI + 點「加入行程」
- **THEN** 開 trip-picker modal 選 trip → POST batch
- **AND** 此流程跟 AddStopModal「收藏」 tab 是**不同 use case**：ExplorePage 流程
  trip-agnostic（user 還沒決定加哪 trip）；AddStopModal 流程 trip-scoped（已知
  當前 trip + day）。兩流程並存解不同 user mental model，不視為 redundancy。

### Requirement: MapPage 加 FAB buttons (圖層 / 定位)

對應 mockup section 20。修改 `src/pages/MapPage.tsx` + `GlobalMapPage.tsx`：

| Finding | Mockup | 修改 |
|---|---|---|
| 圖層 FAB | `#i-layers` icon | Map 右下加 FAB button「圖層」open layer picker（衛星 / 街道 / 地形） |
| 定位 FAB | mockup 有 | Map 右下加 FAB button「定位」 trigger geolocation API + flyTo |
| Day tab overview 第一項 | 「總覽 · 7 天」無顏色點 | MapDayTab 第一項保持 `total days` summary 樣式 |
| Active day tab underline | dayColor border-bottom | MapDayTab active 用 `border-bottom: 2px solid var(--day-color)` |

#### Scenario: 點圖層 FAB 切 layer
- **WHEN** 使用者點地圖右下「圖層」FAB
- **THEN** Popover 顯示 3 layer 選項：街道（default）/ 衛星 / 地形
- **AND** 選後 Leaflet tile layer 切換

#### Scenario: 點定位 FAB
- **WHEN** 使用者點地圖右下「定位」FAB
- **THEN** Browser 提示 geolocation 權限 → 取得位置後地圖 flyTo + 顯示 user marker

### Requirement: 新建 `<AlertPanel>` persistent banner with warning/error variants

對應 mockup section 04 (line 5626-5678)。新 component `src/components/shared/AlertPanel.tsx`：

| Variant | Mockup | 用途 |
|---|---|---|
| `error` | `tp-alert-panel.is-error` | persistent error banner（如「無法載入行程，請檢查網路」） |
| `warning` | `tp-alert-panel.is-warning` | persistent warning（如「離線模式，部分功能受限」） |
| `info` | `tp-alert-panel`（default） | persistent info（如「已恢復連線，正在同步」） |

Component prop：`variant`、`icon`、`title`、`message`、`actionLabel`、`onAction`、`onDismiss`。

跟既有 `Toast`（短暫）、`InlineError`（form field-level）、`ErrorPlaceholder`（empty state-level）區別：AlertPanel 是 page-top persistent banner。

#### Scenario: TripPage 載入失敗顯示 error panel
- **WHEN** TripPage `loadTrip` 失敗
- **THEN** Page 上方 render `<AlertPanel variant="error" title="無法載入行程" message="..." actionLabel="重試" onAction={refetch} />`
- **AND** Panel 不自動消失（需 user 點 dismiss 或 retry 成功）

#### Scenario: 離線時顯示 warning panel
- **WHEN** `useOnlineStatus` 偵測到 offline
- **THEN** App 上方 render `<AlertPanel variant="warning" title="離線模式" message="部分功能受限，連線恢復後會自動同步" />`
- **WHEN** 連線恢復
- **THEN** Panel 切換為 info variant「已恢復連線，正在同步」5 秒後 dismiss
