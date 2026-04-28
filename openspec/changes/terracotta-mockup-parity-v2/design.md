## Context

`docs/design-sessions/terracotta-preview-v2.html` 是 Terracotta layout v2 的單一 source of truth：

- 7,950 行 / 14 個 page section + 5 design-token reference section
- 涵蓋全 IA：DesktopSidebar / BottomNav / NewTripModal / TripPage Detail (Desktop+Compact) / Day hero+chips+stop card / AddStopModal / TripsListPage / ChatPage / ExplorePage / AccountPage / MapPage / Error & Status surfaces
- v2 是上版「terracotta-page-layout」spec 的 visual evolution（已 archive change `2026-04-27-terracotta-pages-refactor` 完成 1st pass）

當前 React 實作已對齊 v2 大部分結構（commit `2b0dc54 refactor(shell): finalize terracotta pages refactor` 跟 archive change 是上次同步點），但累積到 2026-04-28 vs mockup 仍有 ~46 missing / 42 inconsistent / 11 extra finding。Audit 完整結果在本文件 §Audit。

不對齊原因 attribution：
- 部分 section 從 mockup 加入 v2 後 React 還沒 implement（Account hub / AddStopModal modal pattern / TripsListPage filter+search）
- 部分是 IA divergence 由 product 推進方向不同（BottomNav 4-tab trip-scoped vs mockup 5-tab global）
- 部分是 incremental refactor 的 leftover（emoji icon、ExplorePage POI card 結構、ChatPage 文案）

## Goals / Non-Goals

**Goals:**
- 把 14 page section 全部對齊 mockup（visible regression / mockup-defined affordance 缺漏優先）
- 不破壞既有 data / API / route（除新增 `/account` route + 可能新增 `/account/notifications`）
- 拆 5 獨立 capability 各自獨立 ship（不互相依賴），其中 `terracotta-bottom-nav-ia-decision` 需 product decision 才解鎖
- 本 change 全部 capability done 才 archive（跟 `ideas-drag-to-itinerary` archive 條件一致）
- Test：每 capability 自帶 unit test；Account page 加 Playwright E2E；emoji sweep 加 source-grep contract test 防 regression

**Non-Goals:**
- 不重做 mockup 設計（mockup 是固定 reference，發現實作優於 mockup 的 case 個別 propose deviation 不在本 change 內 batch）
- 不改 D1 schema（Account hub 用既有 user / trip / permission table；NewTripModal 多目的地拖拉用 client-side state）
- 不重做整套 IA 架構（除 BottomNav decision 後可能調整 5-tab vs 4-tab）
- 不 mockup section 05-09 / 15（design token / palette / typography / button / DV palette）— 這些是 reference，已落在 css/tokens.css

## Decisions

### 1. Umbrella change with 5 capability spec（vs 5 獨立 change）

**為何**：
- 5 主題互相不 break（emoji sweep 不影響 Account / modal 不影響 nav），但同屬 mockup parity 主題，archive 一次更乾淨
- `ideas-drag-to-itinerary` 已立 1-change-多-capability 先例（drag-to-promote / drag-to-reorder / trip-sheet-state 三 spec dir）
- 各 capability 仍可分別 ship（tasks.md 5 sections），不 force batch ship

**備選**：拆 5 獨立 change — 每個 archive 各自 timeline。Trade-off 是 review overhead 5×；本 change 把 ship 拆給 task section 達同樣 incremental 效果。

### 2. 5 capability 拆分線

| Capability | 主軸 | 為何獨立 | 風險 |
|---|---|---|---|
| `terracotta-icon-svg-sweep` | emoji → SVG | 純視覺 swap，無邏輯改 | 既有 unit test snapshot 要更新 |
| `terracotta-account-hub-page` | 新建 `/account` page + nav | 整頁新增 + sidebar IA 微調 | 跟現有 `/settings/*` page 整合 entry，不重做設定本身 |
| `terracotta-add-stop-modal` | InlineAddPoi → modal 4-tab | UI pattern 大改寫 + interaction model 從 inline expand 改 modal | 跟既有 day-level POI add flow 平滑切換，需 decommission 舊 inline UI |
| `terracotta-ui-parity-polish` | 散落 inconsistency sweep | 跨 13 file 各小 finding，集中 sweep 比 5 個獨立 change 高效 | 變動分散、review 表面廣 |
| `mobile-bottom-nav` (MODIFIED) | 5-tab vs 4-tab IA decision | product 決策題，需先收斂 | 可能 block 其他 page entry 邏輯（探索 / 帳號 tab） |

### 3. `bottom-nav-ia-decision` 第一個 task 必為 product decision

**為何**：5-tab 跟 4-tab 不只是 UI 改動，是「mobile user 的 mental model」決策。mockup 是 global app（每 tab 切 page），React 4-tab 是 trip-scoped（更多 = action sheet）。先決定再實作，避免做完一個方向後 product reverse。

**Decision 路徑**：tasks.md 第一 task 是 invoke `/office-hours` 或 `/plan-ceo-review`，輸出 decision doc 後解鎖後續 implementation task。

### 4. emoji sweep 用既有 `<Icon>` SVG sprite 而非新建 icon

**為何**：`src/components/shared/Icon.tsx` 已含 ~40 SVG sprite（包含 trash / x / search / check 等），新增 emoji 對應只需 path append（lucide / heroicons style 1.5px stroke）。**不**引入新 icon library 增加 bundle。

**對應表**：
- `🗑` → `<Icon name="trash" />` (新增)
- `✕` → `<Icon name="x" />` 或 `close`（既有）
- `⛶` → `<Icon name="maximize" />`（新增）
- `⎘` → `<Icon name="copy" />`（既有）
- `⇅` → `<Icon name="arrows-vertical" />`（新增）
- `🔍` → `<Icon name="search" />`（既有）
- `✓` → `<Icon name="check" />`（既有）

### 5. Account hub `/account` 是 entry hub 不重做 settings

**為何**：既有 `/settings/sessions`、`/settings/connected-apps`、`/settings/developer-apps` 各自 implementation 完整，沒理由全部重寫。Account hub 角色是「unified settings entry」，每 row click navigate 到既有 page。新建的只有：
- `AccountPage.tsx` 自身（hub）
- `NotificationsSettingsPage.tsx`（mockup 規定有「通知設定」row 但目前完全沒 page，本次新建 minimal stub + 之後 polish）

### 6. AddStopModal 重構從 trigger 改成 trip-level

**為何**：mockup 規定 trigger 在 trip detail page 上方（line 6277-6280 `.tp-detail-add-poi`），開啟 modal 後選 day。React 既有 trigger 在 day-level（每 DaySection 末尾「+ 加景點」）。改 trip-level + modal 內選 day 對齊 mockup user flow。

**過渡策略**：先建 modal + 並行保留 inline trigger 1 個 minor 版本確認 UX 沒退化，再拿掉 inline。或直接全切（要看 ship 順序，預設一次切）。

### 7. UI polish capability 內部 sub-grouping by file

**為何**：14 個小 finding 分散 13 個 file，tasks.md 內按 file group 比按 finding type group 高效（同 file 一次改完省 context switch）。tasks Section 5 sub-section 對齊 file boundary。

## Risks / Trade-offs

- **[Risk] 5 capability 並行 implement 互踩腳**（NewTripModal 多目的地拖拉是 polish 但跟 add-stop-modal redesign 都動 modal pattern）
  → Mitigation: tasks.md 標 dependency；polish 內 NewTripModal 部分排在 add-stop-modal capability 之後
- **[Risk] BottomNav IA 決策久久不出**（office-hours / CEO 排期）卡住 polish 的 mobile path 改動
  → Mitigation: polish capability 不含 BottomNav 變動，BottomNav 等 decision 完成才動
- **[Risk] AccountPage 整合 settings 入口時，sidebar 「帳號」nav item 跟現有 logged-in user card 重複** 
  → Mitigation: tasks 含明確「拿掉 user card 或保留 + 「帳號」nav 同時並存」決策子任務
- **[Risk] AddStopModal 重構讓既有 saved POI 流程斷掉**（ExplorePage 我的收藏現在透過「加入行程」modal 加進 trip，跟新 AddStopModal「收藏」tab 概念重疊）
  → Mitigation: 重構時 spec 明確兩流程是同個 saved POI table 不同 entry point；ExplorePage saved 流程不動，AddStopModal「收藏」 tab read-only consume 同 store
- **[Trade-off] 「completeness 修一波」vs「incremental 修細」**：本 change 採前者（一次 audit / 5 capability 一起 implement / 全 done 才 archive），加快 mockup 對齊；缺點是 archive timeline 拉長，兩個月內可能因 mockup itself iterate 又 drift
- **[Trade-off] 不改 D1 schema 限制 Account hub stats**：3 個 stats（N 個行程 / N 天旅程 / N 位旅伴）需 client-side aggregate；trip 多的 user 可能 N+1 fetch 慢。Mitigation: 用 SUM 先寫一個 `/api/account/stats` aggregate endpoint 避免 client-side 算

## Migration Plan

5 capability ship 順序建議：

1. **Week 1**: `terracotta-icon-svg-sweep` (1 PR, ~1 day) — 最低風險、純視覺
2. **Week 1-2**: `mobile-bottom-nav` decision sub-task → office-hours / CEO review → decision doc → 不解鎖後續 task
3. **Week 2**: `terracotta-ui-parity-polish` Section 5.1-5.4 (CSS-only finding，1 PR ~2 day)
4. **Week 3**: `terracotta-account-hub-page` (1 PR, ~3-4 day) — 含新 page + sidebar nav 微調 + stats endpoint
5. **Week 4**: `terracotta-add-stop-modal` (1 PR, ~5 day) — 大改寫，含 modal + 3 tab + batch select
6. **Week 5**: `mobile-bottom-nav` implementation（依 decision 結果）+ `terracotta-ui-parity-polish` 剩餘 Section 5.5+ (mobile path 改動)
7. **Week 5**: `/opsx:archive` 一次 archive 整 change

**Rollback**：每 capability commit 集中在 1 PR，revert 該 PR 即 rollback 該 capability。Account hub 整 page revert 需注意 sidebar nav item 是否一起拿掉。

## Open Questions

- BottomNav IA 5-tab vs 4-tab — **product decision 待回答**：對齊 mockup global IA 還是保留 trip-scoped？
- AddStopModal「收藏」 tab vs ExplorePage「我的收藏」tab — 實作上算同一概念，UI 是否該指向同一 model？mockup 視覺處理不一樣（modal vs page），是 design 故意還是 modeling oversight？
- Notifications page 內容 — mockup row 寫「行程更新 / 旅伴邀請 / 系統通知」分組但沒 mock 實際 page，初版做什麼 minimum？
- Stop card emoji icon 替換是否同時改 trash confirm flow（mockup section 12 lead 吐槽 `window.confirm`）— 算同 capability 還是 polish 內？建議 polish 內處理，icon sweep 純視覺

---

## Audit

完整 mockup vs React 實作對照（2026-04-28 audit）：

### Summary 表

| Section | React file | Missing | Incon. | Extra | 嚴重度 |
|---|---|---|---|---|---|
| 01 Desktop Sidebar | `DesktopSidebar.tsx` | 1 | 4 | 2 | MEDIUM |
| 02 Bottom Nav | `BottomNavBar.tsx` | 0 | 4 | 0 | HIGH (IA 5→4 tab) |
| 03 New Trip Modal | `NewTripModal.tsx` | 5 | 4 | 1 | HIGH |
| 04 Error & Status | `Toast/InlineError/ErrorPlaceholder` | 3 | 2 | 0 | MEDIUM |
| 10 Day hero | `DaySection.tsx` | 1 | 1 | 0 | LOW |
| 11 Day chips | `DayNav.tsx` | 1 | 2 | 1 | LOW |
| 12 Stop card | `TimelineRail.tsx` (RailRow) | 0 | 5 | 1 | MEDIUM (emoji icons) |
| 13 Trip Detail full layout | `TripPage + DaySection` | 4 | 3 | 1 | HIGH (travel pill 缺) |
| 14 Add Stop Modal | `InlineAddPoi.tsx` | 6 | 3 | 0 | HIGH (整 modal 不存在) |
| 16 Trip List | `TripsListPage.tsx` | 4 | 3 | 1 | MEDIUM |
| 17 Chat | `ChatPage.tsx` | 4 | 3 | 1 | MEDIUM |
| 18 Explore | `ExplorePage.tsx` | 5 | 4 | 1 | HIGH |
| 19 Account | (無對應頁面) | 10+ | — | — | HIGH (整 page 不存在) |
| 20 Map | `MapPage + GlobalMapPage` | 2 | 4 | 2 | MEDIUM |

**Total**: ~46 missing / 42 inconsistent / 11 extra（不含 Section 19 的延伸缺口）

### 細節 per section

#### 01 Desktop Sidebar

**Missing**:
- HIGH: 底部 sticky 帳號卡 (avatar + name + email) — mockup line 5114-5117 規範「avatar + name + email」三行區塊；React 已實作 (`tp-account-card`) 但已登入時 name 跟 email 完整顯示沒有 mockup 規定的「name.length > 10 ? slice(0,10)+'…'」JS-level 截字 (line 5132 強制規定)，僅靠 CSS overflow:ellipsis fallback

**Inconsistent**:
- HIGH: Mockup nav item active 樣式為「accent 實心」(`background: --color-accent`, line 5128)；React 用 `background: var(--color-foreground)` + `color: var(--color-background)`（深棕底白字）— 完全不同顏色語意
- MEDIUM: Mockup sidebar 背景應該是 `--color-foreground`（深棕，dark sidebar on cream page，line 5126）；React 用 `var(--color-background)` 米白底 — 整體 sidebar 視覺風格相反
- MEDIUM: Mockup IA 順序「聊天 / 行程 / 地圖 / 探索 / 帳號」(line 5108-5112)；React 第 5 項是「登入」(`label: '登入'`)，logged-in 時就直接 filter 掉 → 沒有「帳號」入口在 nav，只在底部 account card
- LOW: Mockup item 字級規格 14px / lh 20 / weight 600 (line 5129)；React `font-weight: 500`，active 才升 600

**Extra**:
- React 有 `ThemeToggle` 在 sidebar 底部 CTA 區（line 217）— mockup 完全沒有此元件
- React 有「Tripline.」brand 紅點 `.accent-dot`（line 196）— mockup 有相同 `tp-accent-dot`，OK 對得上

#### 02 Bottom Nav

**Inconsistent**:
- HIGH: Mockup IA 為 5-tab「聊天/行程/地圖/探索/帳號」(line 5160-5164)；React 是 4-tab「行程/地圖/助理/更多」(line 78-81) — IA 完全不同，缺「探索」「帳號」入口，多了「更多」action sheet
- HIGH: Mockup tab label 「訊息」(來自 Section 09 `tp-nav-tabs`) 或「聊天」(主 IA)；React 第 3 tab 文案「助理」+ icon 用 `phone` — 跟 mockup「聊天」+ chat icon 不符
- MEDIUM: Mockup 規定 active 樣式「accent-subtle 底 + 2px top indicator + accent text」(line 5228)；React 走 `ocean-bottom-nav` class（在 tokens.css），缺少 mockup 規定的 2px top indicator 元件結構
- LOW: Mockup label 11px/lh 14/weight 700 (line 5227)；React 樣式定義在外部 `ocean-bottom-nav-btn`，需驗證

#### 03 New Trip Modal

**Missing**:
- HIGH: 多目的地拖拉排序 — mockup 核心 spec (line 5254-5283)，每個 dest row 有 grip / 編號 / name / region / remove；React 用 chips list（line 687-708）一行排隊，無拖拉、無編號、無 region 顯示
- HIGH: 目的地數量分配天數 stepper + 推薦地區 chips（mockup Frame 3，line 5424-5448）— React 完全無此 UI
- HIGH: 熱門目的地 chips + recent searches 分組（mockup Frame 2，line 5341-5396）— React dropdown 平鋪 results 無分組
- MEDIUM: Mockup section label「目的地（可加多筆，拖拉排序）」(line 5254)；React label「目的地」(line 685)
- LOW: Mockup helper「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」(line 5288)；React 無此 helper

**Inconsistent**:
- HIGH: Mockup title「新增行程」(line 5247)；React title「想去哪裡？」(line 681) — 完全不同文案語氣
- HIGH: Mockup 日期 mode tabs 文案「固定日期 / 大概時間」(line 5295-5296)；React「選日期 / 彈性日期」(line 762, 772)
- MEDIUM: Mockup actions footer「取消 / 建立行程」對齊右側，無 summary（line 5319-5322）；React 有「summary text + 取消 + 建立行程」三段式 footer（line 866-885）
- LOW: Mockup close button 在 dialog header 內部（line 5248）；React 用 absolute position 浮在右上 covering form pane（line 81-94）

**Extra**:
- React 有 sub-headline「先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。」(line 682) — mockup 無此 copy

#### 04 Error & Status surfaces

**Missing**:
- HIGH: `tp-alert-panel` persistent surface（icon + title + message + action button，mockup line 5632-5648）— React 無此 component；只有 `Toast`、`InlineError`、`ErrorPlaceholder` 三種樣式都不對應 alert panel 結構
- MEDIUM: `tp-alert-panel.is-warning` variant（line 5641-5648）— React 無 warning 等級的 persistent banner（`Toast` 無 warning type，`InlineError` 永遠 destructive）
- MEDIUM: `tp-page-error-box` 全頁錯誤容器（line 5660-5666，「找不到這個行程」+ CTA back to trip）— React 有對應 inline early-return 在 TripPage.tsx 但 styling 不對齊 mockup

**Inconsistent**:
- LOW: Mockup `tp-status-toast`「已恢復連線，正在同步最新行程」(line 5656) — React `Toast` 有 `online` type 但 message 內容由呼叫方決定
- LOW: Mockup `tp-field-error-text`「請選擇出發日期，行程天數才能正確產生。」(line 5653) — React `InlineError` 樣式對齊（destructive footnote）但 message format 與 line-height 1.4 一致

#### 10 Trip day hero

**Missing**:
- LOW: Mockup hero chips area 文案是「水族館・古宇利」一個 chip（line 5914）；React 把 `area` 顯示為單獨 `ocean-hero-chip-muted`（line 131）— 結構對得上
- 注意：mockup 有 `<span class="tp-chip-sep">·</span>` 分隔（line 5911、5913），React 用 `${eyebrow} · ${dateLabel}` template literal 直接拼字串到一個 chip 內 (line 127-130)

**Inconsistent**:
- LOW: Mockup title「美ら海＋古宇利島一日跑」(line 5916) 是日主題 string；React 用 `area || Day ${dayNum}` (line 134) — area 字段是 mockup 的「水族館・古宇利」這種地理 tag，不是日主題字。資料結構未支援 day title 概念

#### 11 Day chips

**Missing**:
- LOW: Mockup chip 顯示「area 字（北谷 / 浮潛・瀨底 / 水族館・古宇利）」(line 5943, 5948, 5953) 在 chip body 第三行；React `dn-area` 已渲染（line 292），結構對齊但 `max-width: 80px` truncation 比 mockup 寬

**Inconsistent**:
- LOW: Mockup eyebrow 為「DAY 03 · 今天」用 `·` 分隔 + 中文「今天」(line 5951)；React eyebrow `parts.eyebrow` 只放 `DAY 03`，今天標記 `<span className="dn-weather">TODAY</span>` 是另一獨立 pill（line 286）— 文案 + 視覺實作不同
- LOW: Mockup `tp-day-chip-date` 顯示「7/29」「7/30」(line 5942, 5947)；React `dn-date` 渲染 `${month}/${day}` + `<span className="dn-dow">` 多加週幾英文 — extra 元素

**Extra**:
- React `ocean-day-strip` 有 `MAP 全覽` chip 在尾端（line 306-322）— mockup 無此 overview chip

#### 12 Stop card

**Inconsistent**:
- HIGH: Mockup expanded toolbar 有 6 個 SVG icon button：放大 / 複製 / 移動 / 編輯備註 / [spacer] / 刪除 / 收闔 (line 6074-6080)；React `tp-rail-actions`（line 401-469）有：放大檢視（chip with text 不是 icon-only）+ 複製 + 移動 + 刪除 + 收闔，缺少「編輯備註」獨立按鈕（備註 inline click-to-edit）
- HIGH: Mockup 用 unified `<svg><use href="#i-trash"/>` SVG sprites；React 用 emoji unicode：`🗑` (line 457)、`✕` (line 467)、`⛶` (line 409)、`⎘` (line 423)、`⇅` (line 433) — 即 mockup section 12 lead 明文吐槽的問題：「`⎘⇅🗑✕` 是 unicode/emoji 跨字型不一致」(line 5971)
- MEDIUM: Mockup 規定「delete confirm 不應用 `window.confirm`」(line 5971 lead)；React `handleDelete` line 297 仍用 `window.confirm`
- MEDIUM: Mockup `tp-stop-v-grip` collapsed 狀態低調，hover row 才浮現（line 6034 tagline）；React `ocean-rail-grip` 永遠可見，無 hover 邏輯切換
- LOW: Mockup row 結構：grip / time / icon (poi type) / type label + name + meta / caret (line 6043-6053)；React 結構：time / dot (number) / grip / icon / content / caret — `.ocean-rail-dot` 是 React 多出的 numbered dot

**Extra**:
- React `tp-rail-detail` 有「備註」section with click-to-edit textarea + ⌘+Enter / Esc keyboard shortcuts（line 504-558）— mockup 沒有此 inline note editing UI（mockup 只有 toolbar pencil button）

#### 13 Trip Detail full layout

**Missing**:
- HIGH: Mockup desktop titlebar 有「建議 / 共編 / 下載」三個 ghost buttons + 更多 icon button（line 6100-6103）；React TripPage titlebar 只有 3 個 icon-only buttons (lightbulb / group / download) + OverflowMenu (line 710-744)，沒文字 label 且 mockup 是 `tp-btn is-ghost` icon+text combo
- HIGH: Mockup 用 travel pill 元件 (line 6179-6184) 顯示「🚗 10 min · 4.2 km」在每兩個 stop 之間；React TimelineRail 完全無 travel pill 渲染（無 inter-stop transit 視覺）
- HIGH: Mockup expanded entry 有「說明 / 備註」結構化 sections（h4 + body, line 6231-6238）；React `tp-rail-detail-section` (line 471-502) 結構對齊但 mockup 還有「+ 加備註」 empty state link（React 用 `tp-rail-note-value.is-empty` 字串「+ 加備註」line 556 — 對齊 OK）
- MEDIUM: Mockup compact 版本 day nav pill 用「D 02 / D 03」縮寫 (line 6298, 6303)；React `DayNav` 永遠用「DAY 02」+ 7/30 兩段格式，無 compact 縮寫切換

**Inconsistent**:
- HIGH: Mockup `tp-detail-rail-header` 顯示 `Itinerary · 7 stops · 08:00–21:00`（line 6155-6158）；React `ocean-rail-header` 渲染相同結構（line 639-643）— 對齊 OK
- MEDIUM: Mockup row 有 `tp-detail-dot` 顯示 1 / 2 / 3 序號（line 6166, 6189, 6215）；React 有對應 `ocean-rail-dot` (line 351) — 對齊 OK
- LOW: Mockup hero `tp-detail-hero-eyebrow` 一行「DAY 03 · 2026-07-31（五）· 水族館・古宇利」(line 6136)；React DaySection 拆成兩個 chips (line 127-131)

**Extra**:
- React TitleBar 有 back button + back to /trips (line 706)；mockup 用 `tp-preview-icon-button`「返回列表」(line 6097) — 都有 back affordance OK

#### 14 Add Stop Modal

**Missing**:
- HIGH: Modal 整體結構完全不存在 — mockup line 6428-6711 規範 4-frame modal (搜尋/收藏/自訂 3-tab + 兩種 saved state)。React 用 `InlineAddPoi` 在 DaySection 內 inline expand（不是 modal），沒 tabs、沒 modal layout
- HIGH:「收藏」tab 完整流程 (mockup Frame 2 + 3，line 6527-6640) — React 無 saved-pois-in-context 概念；saved POI 只在 ExplorePage `我的收藏` tab 看，不能從 trip detail 取用
- HIGH:「自訂」tab form (mockup Frame 4，line 6642-6709)：標題 / 地址 / 開始時間 / 結束時間 / 類型 / 預估停留 / 備註 — React `InlineAddPoi` 只能搜尋 POI，無自訂 form
- HIGH: 2-col grid POI cards with cover photo（mockup line 6470-6515 `tp-add-poi-card`）— React 用 1-col list `tp-inline-add-result` (line 130-149)，無 cover photo
- MEDIUM: Region selector「沖繩 ▾」(line 6452-6454)、filter button「📋 篩選」(line 6460)、subtab chips「為你推薦/景點/美食/住宿/購物」(line 6462-6467) — 全無對應 React 元件
- MEDIUM: Mockup footer「已選 N 個 · 將加入 Day 03 · 7/31」+ 取消 / 完成 buttons (line 6517-6523)；React `InlineAddPoi` 是 single-add per click，無 batch select / footer summary

**Inconsistent**:
- HIGH: Mockup「+ 加入景點」trigger 在 trip detail page level（line 6277-6280 `.tp-detail-add-poi`）開啟 modal；React trigger 在每個 DaySection 末尾 (`.tp-inline-add-trigger`, line 286-294) inline expand — placement + interaction model 不同
- MEDIUM: Mockup head meta「DAY 03 · 7/31（五）」(line 6442)；React inline-add head「在 Day {dayNum} 加景點」(line 305) — 文案結構不同
- LOW: Mockup search input 用 SVG icon (`#i-search`, line 6457)；React 用 emoji `🔍` (line 318) — anti-pattern emoji

#### 16 Trip List

**Missing**:
- HIGH: Mockup toolbar 有「全部 / 我的行程 / 共編行程 / 已歸檔」filter subtabs +「最新編輯 ▾」sort dropdown (line 6890-6897)；React TripsListPage 完全無 filter / sort UI
- HIGH: Mockup desktop header 有「搜尋 / 新增行程」兩個 ghost+primary buttons (line 6884-6887)；React 只有 plus icon button (line 685-694)，無搜尋
- HIGH: Mockup search active state 完整流程（line 6974-7016）：search bar 展開 + cancel + result count + `<mark>` highlight — React 無 search functionality
- LOW: Mockup empty state 文案「還沒有行程 / 建立第一個行程，開始規劃你的下一趟旅程。也可以從探索頁尋找靈感。」(line 7101-7102)；React empty state 文案「還沒開始任何行程 / 建立第一個行程，AI 會幫你排日程、餐廳、住宿。」(line 713-714) — 用語不一致

**Inconsistent**:
- MEDIUM: Mockup card meta 包含「owner avatar + name + 出發日」(line 6906-6909, `tp-list-card-avatar` + `tp-list-card-meta-text`)；React card meta 只有「日期範圍 + N 旅伴」(line 378-389)，無 owner avatar、無 owner name
- MEDIUM: Mockup eyebrow 用「日本 · 12 天」中文 (line 6904)；React eyebrow 用「JAPAN · 12 DAYS」全英文 (line 353-364)
- LOW: Mockup card header 文案「我的行程」(line 6882) — React 對齊 (line 683)

**Extra**:
- React 有 `is-active` border highlight on selected card (line 736)；mockup 有同樣 `tp-list-card.is-active` (line 6900) — 對齊

#### 17 Chat

**Missing**:
- HIGH: Chat list view（對話 list） — mockup line 7125-7167 規範一個 chat list page（每個 trip 一個對話 row，含 avatar / name / preview / time / unread badge）；React ChatPage 直接是單一 conversation view，無 list 模式，活的 trip 用 dropdown picker 切換
- HIGH: Mockup conversation 有「day divider」`tp-chat-day-divider` (line 7226, 7233) — React 無 day divider 渲染
- HIGH: Mockup conversation 有「bubble timestamp meta」獨立行 `tp-chat-bubble-meta` 顯示 `Tripline AI · 14:02` (line 7228, 7232) — React 用 `tp-chat-msg-time` (line 730-738) 但只顯示時間，無「Tripline AI · 」prefix
- LOW: Mockup `tp-chat-bubble-suggestions` 用 inline 在 AI bubble 內 (line 7237-7240)；React `tp-chat-suggestions` 在 empty state 才出現 (line 688-702)

**Inconsistent**:
- MEDIUM: Mockup `tp-chat-input` 是 textarea + send icon button (line 7245-7247)；React `tp-chat-composer` 是 textarea +「送出」text button (line 769-776) — 視覺不同（mockup icon-only, React text-only）
- MEDIUM: Mockup conversation header 文案「沖繩 + 大阪 + 京都跨城」(line 7219) 是直接顯示 trip name；React 標題永遠是「聊天」(line 627)，trip name 只在 trip-picker pill 內顯示
- LOW: Mockup `tp-chat-avatar.is-ai` AI 標識「AI」(line 7127, 7148)；React 無 AI avatar 渲染（messages 直接顯示 bubble，無 avatar）

**Extra**:
- React 有 `tp-chat-trip-picker` pill 切 trip (line 631-641)；mockup 在 conversation 模式無此切換 affordance（chat list 才能換 thread）

#### 18 Explore

**Missing**:
- HIGH: POI grid card 視覺結構完全不同 — mockup `tp-explore-card` 有 cover photo (`tp-explore-card-cover` with `data-tone`) + ❤ favorite toggle right-corner + name + ★ rating meta (line 7313-7319)；React `explore-poi-card` 是 text-only card with category eyebrow + name + address +「+ 儲存」button (line 569-587)，無 cover, 無 ❤ icon, 無 rating
- HIGH:「我的收藏」titlebar action（mockup line 7294 ghost button with heart icon, line 7370 compact icon button）— React 用 `Icon name="star"` (line 513) 切到 saved tab — icon 跟 mockup 不同（heart vs star）
- HIGH: Region selector「沖繩 ▾」(line 7299, 7375) — React 無 region picker UI
- HIGH: Subtab chips「為你推薦 / 景點 / 美食 / 住宿 / 購物」(line 7305-7311, 7381-7386) — React 只有「搜尋 / 我的收藏」兩 tab 結構，無 POI 類型 sub-filter
- MEDIUM: Mockup compact 版用 `tp-page-titlebar` heart icon button (line 7370) — React 已對齊（star icon）

**Inconsistent**:
- HIGH: Mockup desktop title「探索」+ 右側「我的收藏」ghost button (line 7292-7295)；React 標題「探索」對齊 (line 503) 但 actions 用 star icon button (line 506-514)
- MEDIUM: Mockup search 有 visual rendering 為「`tp-explore-search` flat row with icon」(line 7301-7304)；React 為 form with input + submit button (line 545-557) — 互動模型不同（mockup 用 chip-tap 觸發，React 要打字 + 按 Enter）
- MEDIUM: Mockup card hover「accent 邊框 + lift shadow」(section lead line 7287)；React card 只有 `border-color: --color-accent` + `is-selected` state，無 hover lift transform
- LOW: Mockup card meta「★ 4.6 · ¥2,180」(line 7318)；React card meta 顯示「address truncated」(line 572)

**Extra**:
- React 有「我的收藏 multi-select + 加入行程 modal」流程 (line 620-740)；mockup 無此 batch-add-to-trip flow

#### 19 Account

**Missing** (10+ items, 整 page 不存在):
- HIGH: 完整 Account page 不存在 — mockup line 7425-7581 規範一個 unified 帳號頁（profile hero + 應用程式 / 共編&整合 / 帳號 三組 settings rows）；React 無對應頁面，分散到 `/settings/sessions`、`/settings/connected-apps`、`/settings/developer-apps` 三個獨立頁
- HIGH: Profile hero 元件（avatar 64px + name + email + 3 個 stats: N 個行程 / N 天旅程 / N 位旅伴, line 7437-7448）— React 完全無此 component
- HIGH: Settings list rows 元件（icon 圓形 box + title + helper + chevron, line 7452-7515）— React 無此模式（各 settings page 各自做 form/table）
- HIGH: Section labels「應用程式 / 共編 & 整合 / 帳號」分組 (line 7450, 7470, 7498) — React 無 grouping
- HIGH:「外觀設定」row (line 7452-7459) — React 無此 standalone page，theme toggle 只在 sidebar bottom
- HIGH:「通知設定」row (line 7460-7467) — React 完全無通知 page
- HIGH:「已連結 App」row (line 7480-7487) — 有對應 page (`ConnectedAppsPage.tsx`) 但 entry 在 sidebar bottom + URL 直連，無 account-page 入口
- HIGH:「開發者選項」row (line 7488-7495) — 有對應 page (`DeveloperAppsPage.tsx`)，無 account-page 入口
- MEDIUM:「已登入裝置」row (line 7500-7507) — 有 `SessionsPage.tsx`，無 account-page 入口
- HIGH: 登出 destructive row (line 7508-7515 `tp-account-row.is-danger`) — React 無顯式登出 UI（CLAUDE.md feedback 指 `/devex-review 2026-04-26` 把登出 link 拿掉，要求走 sessions page revoke device row）

#### 20 Map

**Missing**:
- MEDIUM: Mockup 有「圖層」FAB button (`#i-layers`, line 7619) + 定位 FAB — React MapPage 沒有 FAB UI（OceanMap 內部有 controls 但不對齊 mockup `tp-map-fabs`）
- LOW: Mockup desktop titlebar 有 trip switcher ghost button「沖繩 + 大阪 + 京都」(line 7593) — React MapPage TitleBar (line 31) 無此元件；GlobalMapPage 有 trip switcher dropdown 但放在 absolute positioned card (`tp-global-map-header`)，不在 titlebar

**Inconsistent**:
- HIGH: Mockup day tab 第一項是「總覽 · 7 天」(line 7624-7627)，無顏色點 + 無 hyphen；後續 day tabs 用 `dayColor` 著色 eyebrow + DAY 0X format (line 7628-7647)。React MapPage 用 `MapDayTab` 組件（line 33），結構應大致對齊但第一項 overview tab 視覺需驗證
- MEDIUM: Mockup 規定 active day tab「用 dayColor border-bottom」(section lead line 7586) underline tab pattern；MapPage SCOPED_STYLES 未含對應 CSS（依賴 `MapDayTab` 內部）
- MEDIUM: Mockup `tp-map-entry-card` 含 num badge (border 顏色 = dayColor) + D{N} prefix (顏色 = dayColor) + time + icon + title (line 7650-7660)；React 用 `MapEntryCard` 組件 — 結構需驗證 `D{N}` overview prefix 是否實作 (MapPage line 232-241 有 `entryDayMap` 邏輯但需對照 component output)
- LOW: Mockup loading state「地圖載入中… + spinner」(line 7855-7860)；React `map-page-loading` 已實作對齊 (line 52-78)

**Extra**:
- React MapPage 有 `?day=all`、`?day=N`、`/stop/:entryId/map` deep-link routing (line 4-21) — 是 mockup 沒寫但合理擴充
- GlobalMapPage 加 trip switcher dropdown + dropdown rows 顯示其他 trips (`tp-global-map-dropdown`) — mockup 無此 cross-trip 切換 UI

### 整體觀察

1. **最大缺口**：Section 19 (Account) 是新建 unified page 的需求，目前完全沒有對應實作；Section 14 (Add Stop Modal) 是大改造，目前 InlineAddPoi 不是 modal、無 tabs、無收藏 / 自訂模式
2. **共通 anti-pattern**：emoji 用作 icon 普遍（TimelineRail 的 `🗑 ✕ ⛶ ⎘ ⇅`、InlineAddPoi 的 `🔍`、ExplorePage 的 `✓` 等），mockup 全用 SVG sprites — 違反 mockup section 12 lead 明文吐槽的問題
3. **IA 不一致**：Bottom Nav React 走 4-tab trip-scoped（行程/地圖/助理/更多）vs mockup 5-tab global（聊天/行程/地圖/探索/帳號）— 屬於主要架構 deviation，需 product decision
4. **共通 deviation**：mockup 多個 tab/filter 元件未實作（trip list filter subtabs、explore subtabs by POI type、region selector）— UI 框架缺口
