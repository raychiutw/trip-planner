# E 類 Deferred 項目 — 決策紀錄

本檔追蹤 ABCD 完成後剩 4 個 E 類 deferred 項目的逐一討論結果。

## E1 — Section 2.2: `tests/api/account-stats.integration.test.ts`

**Status**: 決定 → **A) 直接補 integration test**（待後續 PR 執行）
**決策時間**: 2026-04-28

### Context
`functions/api/account/stats.ts` 已 land：requireAuth + 3 SQL aggregate (COUNT trips / SUM days / COUNT distinct collaborators)。AccountPage hero 直接 render 這三個數字，user-facing 顯示。

### 為何選 A
- endpoint 雖薄，但 user-facing stat 算錯 (e.g. collaborator 把 owner 也算進去 / JOIN 漏了某天) → user 看到錯誤數字，trust signal 直接受損
- 既有 `tests/api/` suite 用 vitest + miniflare D1 local，可重複跑不依賴 staging
- fixture setup 一次性（trips + trip_days + trip_permissions sample rows），~30 min 投資

### Implementation 範圍
1. 建 fixture: 1 owner + 2 trips (各 5 / 7 days) + 3 collaborators (含 owner 重複) → 預期 stats = `{ tripCount: 2, totalDays: 12, collaboratorCount: 2 }` (distinct 排除 owner 自己)
2. Test case:
   - Happy path: stats 數字正確
   - Empty: 0 trips 回 0/0/0
   - Edge: collaborator 重複出現多 trip → distinct 算 1 次
   - Auth: unauthenticated → 401
3. 拷貝既有 `tests/api/_setup.ts` pattern (or whatever the project uses)

### Follow-up PR
- Branch: `feature/account-stats-integration-test`
- 預估 ~100 行 (fixture + 3-4 case)
- 不阻擋 main parity PR ship

---

## E2 — Section 4.2.9: NewTripModal dropdown 分組顯示

**Status**: 決定 → **A.2) chip-blocks-below 為 mockup 同需求的 alternative
implementation path**（不標 deviation，spec 維持，視覺實作換 pattern 達同需求）
**決策時間**: 2026-04-28（reframe 2026-04-28: mockup 是 source of truth，
chip-blocks 不是 deviation 是同需求的 implementation 變體）

### Context
Mockup section 03 規範 search dropdown 改為「熱門 / 最近搜尋 / 搜尋結果」3 組
group display。**Mockup intent**: discoverability + recall — 讓 user 看到熱門
目的地與最近搜尋過的 quick start。

現有實作（Section 4.2.8 已 land）採 chip-blocks-below pattern：chip 在 input
**下方**獨立區塊，input 為空時顯示。**達成同 mockup intent**（discoverability
+ recall），透過不同視覺 pattern。

### 為何選 A.2 (alternative implementation, not deviation)
- mockup 規範的核心是「讓 user 看到熱門 + 最近」 — chip-blocks-below 完整滿足
- chip-blocks 對 mobile 高度受限環境更友善（dropdown 高度有限會擠掉 search results）
- 已 land + 跑過 23 unit case 全 pass，不需重 build

### Implementation 範圍 (待開工 reframe spec 文字)
1. **不 reverse implementation** — chip-blocks 維持
2. **spec 文字 reframe**：
   - `specs/terracotta-ui-parity-polish/spec.md` line 46
   - 原文「Search dropdown 結果改為分組顯示（不平鋪）」
   - reframe 為：「discoverability + recall 機制（mockup 用 dropdown 分組，本實作
     用 input 下方 chip-blocks pattern 達同需求）」
   - 不加 strikethrough，標明兩種 pattern 等價達 mockup intent
3. design-review 對齊：mockup parity 不視 chip-blocks-below 為 deviation

### Follow-up
- 跟其他 E 類項目一起開工（spec 文字 reframe + UI 不動）
- 如未來 user research 顯示 dropdown-grouped 表現更好，再 reopen 並重 build

---

## E3 — Section 4.9.7: ExplorePage 儲存池流程重評估

**Status**: 決定 → **B + 文案 rename + UI 對齊 mockup section 18**
**決策時間**: 2026-04-28

### Context
ExplorePage 既有 2-tab 結構（搜尋 / 儲存池），含 multi-select + 加入行程 modal。
add-stop-modal 收藏 tab 已 cover「在 trip context 內挑收藏」 use case，但 ExplorePage
儲存池 cover「不綁 trip 先存著之後再決定」 use case，**兩流程解不同問題不是 redundancy**。

### 為何選 B + 文案 + UI 對齊
1. **保留兩流程**（B）：trip-agnostic vs trip-scoped 是不同 use case
2. **「儲存池」非台灣慣用語** → 全 codebase rename 為「我的收藏」
3. **mockup section 18 無 tab pair 結構**：要對齊 mockup 視覺，
   需拿掉「搜尋 / 儲存池」 tab，改用 TitleBar action button toggle 兩 view
4. mockup section 18 element 順序：region pill → search → subtab → grid

### Implementation 範圍 (待開工)
1. **文案 rename**：
   - `src/pages/ExplorePage.tsx`：所有「儲存池」→「我的收藏」
   - `src/pages/LoginPage.tsx`：「儲存池跟著你」→「我的收藏跟著你」
   - `src/pages/SignupPage.tsx`：同上
   - `src/types/api.ts` comment：「/explore 儲存池」→「/explore 我的收藏」
   - `tests/unit/explore-page.test.tsx`：test description rename
   - `tests/e2e/api-mocks.js` fixture note：「從探索儲存池加入」→「從探索我的收藏加入」
2. **拿掉 .explore-tabs UI + CSS**：mockup section 18 無 tab pair
3. **TitleBar dynamic toggle**：
   - search view：title「探索」 + action「我的收藏」 button (heart icon)
   - saved view：title「我的收藏」 + back button「返回探索」
4. **mockup element 順序對齊**：region pill → search bar → subtab chips → grid
   （目前 search bar 在 region 之上，需要對調）
5. **mockup 細節對齊**：
   - search placeholder：「搜尋景點、餐廳、住宿…」 (mockup line 7303) 取代
     既有「搜尋 POI（例：沖繩水族館、首爾燒肉）」
   - grid: desktop 3-col / mobile 2-col (mockup line 7290 / 7366)
6. **spec 對齊**：`specs/terracotta-ui-parity-polish/spec.md` Section 4.9 加
   「拿掉 tab pair」「改用 TitleBar toggle」「element 順序」 三項目修改
7. **既有 unit test 更新**：explore-page.test.tsx 拿掉 tab-saved testid assert，
   改用 TitleBar action click → 驗 saved view 顯示

### Follow-up
- 跟其他 E 類項目一起開工

---

## E4 — Section 5.x: mobile-bottom-nav 5-tab vs 4-tab 實作

**Status**: 決定 → **A) Adopt 5-tab (mockup-aligned)** + **新增「active trip context」機制**
**決策時間**: 2026-04-28

### Context
mockup 規範 5-tab global nav (聊天/行程/地圖/探索/帳號)，React 現況是 4-tab
trip-scoped (行程/地圖/助理/更多)。`notes/bottom-nav-ia-decision.md` 列了完整
Option A/B/C 對比 + impact 分析。

### 為何選 A
- 對齊 mockup spec source of truth (與 design-review 1:1)
- 帳號 + 探索 進 nav 提升 discoverability（mockup 設計 author 認為 prominent
  navigation 比 trip-scoped 一鍵切換更重要）
- 5 tab 是 standard mobile app pattern (Instagram / Linear / Notion 都用)，
  user 熟悉度高
- trip-scoped workflow 退步 (in-trip 切地圖/聊天多 1 step) 由「active trip
  context」機制補償（見下方 implementation 範圍）

### 額外需求：active trip context 自動帶入
**問題**：5-tab IA 後，/map / /chat / 探索 都是 global route，不再帶 trip
參數。User 在 /trip/okinawa 看完，點底部「地圖」 tab → 切到 /map 全域 page，
**地圖該預設顯示哪個 trip？**

**解法**：app-level 「active trip context」，記憶 user 最近 active 的 trip id：
- localStorage key `LS_KEY_TRIP_PREF`（已存在，目前各頁散用）→ 升級為 canonical
- React Context provider 包在 app root，subscribe localStorage 變動
- 規則：user 進入 `/trip/:tripId` 或 `/trips?selected=X` → 自動 setActiveTrip(X)
- /map 預設 redirect 到 `/trip/:active/map`（或 inline 用 active trip pin）
- /chat 預設 active trip 對應的 chat thread（既有 ChatPage 已用 LS_KEY_TRIP_PREF
  但分散邏輯，集中到 context）
- /explore region 預設 active trip's countries（既有 region pill 預設「全部地區」
  → 改 default = active trip country if any）
- 帳號 + 探索 不影響 active trip context

### Implementation 範圍 (待開工)

#### 5.x.1 — Active trip context 基礎
1. 新建 `src/contexts/ActiveTripContext.tsx`：provider + hook `useActiveTrip()`
   - State: `activeTripId: string | null`
   - Actions: `setActiveTrip(id)` (持久化到 localStorage)
   - Subscribe: window storage event 同 tab 多視窗 sync
2. 包進 `src/entries/main.tsx` app root (在 BrowserRouter 之外)
3. 既有用 `lsGet(LS_KEY_TRIP_PREF)` 散用各頁全部改用 `useActiveTrip()`
4. `/trip/:tripId` 進入時自動 `setActiveTrip(tripId)` (TripPage useEffect)

#### 5.x.2 — 5-tab BottomNavBar 改寫
1. 修改 `src/components/shell/BottomNavBar.tsx`：
   - 5 tab list (聊天 / 行程 / 地圖 / 探索 / 帳號)
   - CSS grid `repeat(5, 1fr)`
   - active state 2px top indicator + accent-subtle 底
   - Tab href 全部 global route：`/chat` `/trips` `/map` `/explore` `/account`
2. 拿掉「更多」 action sheet pattern + handler

#### 5.x.3 —「更多」 sheet 4 個 action 遷移新家
| 原 sheet item | 新家 |
|---|---|
| 共編 | trip detail TitleBar 「共編」 button (Section 4.6 已 land) |
| 切換行程 | 行程 tab (`/trips`) 內 card grid (既有) |
| 外觀 | AccountPage「外觀設定」 row (Section 2 已 land) |
| 下載 / 列印 | trip detail TitleBar OverflowMenu (既有) |

→ 4 個 action 都已有新入口，只需移除「更多」 sheet trigger，無需新建任何 UI

#### 5.x.4 — Active trip 整合各 global route
1. `/map` (MapPage)：mount 時讀 `useActiveTrip()` → 若有 → redirect 到
   `/trip/:active/map`；若無 → 顯示「請先選擇行程」 empty state + 「去選行程」
   button → /trips
2. `/chat` (ChatPage)：mount 時讀 `useActiveTrip()` → 預設 picker selected =
   activeTripId（既有 lsGet LS_KEY_TRIP_PREF 已類似但拆散）
3. `/explore` (ExplorePage) region 預設：讀 active trip's `countries`
   → 對應 region 文字 (e.g. countries='JP' → region '沖繩')；無 active 用
   「全部地區」
4. `/trips` (TripsListPage)：保留現狀，user click trip card → setActiveTrip

#### 5.x.5 — Active tab regex 不誤觸
- `/manage/map-xxx` 不該觸發「地圖」 tab active (要驗 path 精確 match)

#### 5.x.6 — 測試 + spec 對齊
1. 寫 unit test `tests/unit/bottom-nav-5-tab.test.tsx`：5 tab render +
   active 判斷 + 觸控目標 ≥44px
2. 寫 unit test `tests/unit/active-trip-context.test.tsx`：setActiveTrip
   localStorage persistence + cross-tab sync + auto-set on /trip/:id mount
3. 寫 Playwright E2E `tests/e2e/bottom-nav-flow.spec.js`：5 tab navigation +
   /trip/X → 切「地圖」 tab → 預設 /trip/X/map (不是空 state)
4. spec 對齊：archive 既有 `mobile-bottom-nav.md` 4-tab spec，新 spec 為
   5-tab + active-trip-context 雙特性合一

### 風險
- **Implementation 大**：~6 個 sub-task，跨 5 頁 + 1 個新 context + 1 個 nav
  rewrite + 至少 2 個 unit test + 1 個 E2E。預估 1.5-2 days 工作量
- **既有 trip-scoped UX 退步緩衝**：active trip context 機制是補償，但
  in-trip user 切地圖/聊天的「無 page 切換」感喪失，視覺上 page transition
  會明顯
- **/map empty state**：no active trip 時的 empty state 設計待定

### Follow-up
- 跟其他 E 類項目一起開工
- Active trip context 是 enabler，未來其他 cross-trip global feature 受惠
