# Design System — Tripline（V2 Terracotta）

## Product Context
- **What this is:** 行程共享網站 — 旅伴可以瀏覽精美行程表（時間軸、餐廳推薦、飯店、地圖導航）
- **Who it's for:** 旅伴（家人朋友），非技術人員，旅行中在手機上使用
- **Space/industry:** 旅行行程規劃，偏向個人/小團體（非商業旅遊平台）
- **Project type:** Mobile-first PWA（React SPA + Cloudflare Pages）

## Aesthetic Direction
- **Direction:** Warm editorial — 明信片／旅遊雜誌的暖色排版，cream-paper + 焦糖陶土
- **Decoration level:** Restrained — 靠排版、留白、hairline、單一 terracotta accent 支撐畫面，不靠裝飾 SVG
- **Mood:** 旅途上的溫度、紙本旅遊書的安心感。奶油底（`#FFFBF5`）+ terracotta 焦糖（`#D97848`）accent 把行程資訊保持主角，避免 SaaS 冷藍感
- **Differentiation:** 單一色調 V2 Terracotta（非六主題切換、非冷色 Ocean）、Airbnb 式三層陰影但 rgba 用暖棕（`rgba(42, 31, 24, …)`）、Inter + Noto Sans TC 排版
- **Reference sites:** Airbnb（card + shadow）、Apple HIG（tap target、subheadline）、Anthropic Claude Design 稿（Okinawa Trip Redesign/Mobile）、`docs/design-sessions/mockup-trip-v2.html`（V2 canonical mockup）

## Palette — V2 Terracotta（canonical source: tokens.css `@theme`）
| Token | Hex | 用途 |
|-------|-----|------|
| `--color-accent` | `#D97848` | UI chrome 唯一主色（active state、CTA、link） |
| `--color-accent-deep` | `#B85C2E` | hover / pressed |
| `--color-accent-subtle` | `#FBEEE4` | badge bg、selected row |
| `--color-accent-bg` | `#F7DFCB` | accent panel |
| `--color-background` | `#FFFBF5` | page bg |
| `--color-secondary` | `#FAF4EA` | card bg |
| `--color-foreground` | `#2A1F18` | body text |
| `--color-muted` | `#6F5A47` | secondary text |
| `--color-border` | `#EADFCF` | hairline |
| `--color-line-strong` | `#C8B89F` | divider strong |

> **Day palette exception**: 10 色 Tailwind -500（sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald）**只用於地圖** — map polyline + Map page bottom day strip eyebrow + active underline。對應 Data Visualization 例外。**Trip 明細頁 day strip 嚴守 Terracotta 單色 accent**（idle eyebrow muted, active eyebrow + underline 用 `var(--color-accent)`），不套 dayColor。理由：多色服務於地圖 N 條線視覺區分需求；trip 明細頁不需要區分多 day，反而 chrome 一致性更重要。

## Typography

### Font Stack
- **Primary:** `Inter` — Web font，400/500/600/700 weight
- **CJK Secondary:** `Noto Sans TC` — 中文字體優先於系統字
- **Fallback:** `"PingFang TC", "Microsoft JhengHei", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Rationale:** Inter 處理英文、數字、時間、UI label；Noto Sans TC 穩定中文顯示；系統字做最後 fallback
- **Loading:** `<link>` 預連線 + `display=swap`（不阻擋首屏）

### Type Scale

桌機與 compact 使用同一組 font family，但各自有一套角色型字級。所有頁面與元件應吃 token，不直接寫零散 `font-size`。

| Token | Desktop | Compact | Weight | 用途 |
|-------|---------|---------|--------|------|
| `titlebar` | 20px / 28px | 18px / 24px | 700 | Sticky titlebar 單行標題 |
| `page-title` | 28px / 36px | 24px / 32px | 700 | 內容區主標題、行程名稱 |
| `section-title` | 20px / 28px | 18px / 26px | 700 | 內容 section 標題 |
| `card-title` | 17px / 24px | 16px / 24px | 700 | 卡片標題、stop name |
| `body` | 16px / 26px | 16px / 26px | 400 | 主要中文內文 |
| `support` | 14px / 22px | 14px / 22px | 400 | 輔助文字、描述、提示 |
| `footnote` / `support` | 14px / 22px | 14px / 22px | 400 | 介於 body 與 label 之間（chat preview / list meta / micro UI），對齊 `--font-size-footnote`（tokens.css 0.875rem） |
| `label` | 12px / 16px | 12px / 16px | 600 | 表單 label、metadata、chip label |
| `sidebar-item` | 14px / 20px | n/a | 600 | Desktop sidebar nav |
| `bottom-nav-label` | n/a | 11px / 14px | 700 | Compact bottom nav label |
| `eyebrow` | 10px / 14px | 10px / 14px | 600 | 僅用於 uppercase label，例如 `DAY 01` |

### Weight Scale
| Token | Value | 用途 |
|-------|-------|------|
| normal | 400 | body 內文 |
| medium | 500 | 輕強調，少用 |
| semibold | 600 | 按鈕、nav、label |
| bold | 700 | 標題、日期數字、重要卡片標題 |
| heavy | 800 | 不作為中文常規字重；僅限極少數英文品牌字樣 |

### Specialised Patterns
- **Font family:** 桌機與 compact 不換 font family，避免品牌語氣分裂與載入成本增加。
- **Titlebar is chrome:** titlebar 不使用 page-title 字級。桌機 20px、compact 18px 是上限。
- **Chinese body:** 內文不低於 16px；中文行高保持 26px，手機也不壓縮。
- **Letter spacing:** 中文一律 `letter-spacing: 0`。Uppercase `eyebrow` 用 `0.12em`。**Latin uppercase 在 chip / pill / segmented label** 可用 `0.04–0.08em`（純拉丁字 / 數字 / 縮寫如 `DAY 01`、`HOTEL`、`SIGHT`），但中英混排或主要中文字段仍須 `0`。
- **Eyebrow / uppercase labels**：`font-size: 10px; line-height: 14px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;`
- **Tabular numbers**：時間（16:30）、日期（7/2）一律 `font-variant-numeric: tabular-nums`

## Color

### Approach
**V2 Terracotta 單主題** — `#D97848` 是唯一 UI chrome accent。CTA、active state、link、sight/food icon 可用 terracotta；其餘介面元素用 warm neutrals，避免回到冷藍 Ocean 或多主題切換。

### Light Mode (Terracotta — Default)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#D97848` | 主要強調色（CTA、active tab、link、sight/food icon） |
| accent-deep | `#B85C2E` | hover / pressed |
| accent-subtle | `#FBEEE4` | hover、selected row、chip bg |
| accent-bg | `#F7DFCB` | badge、淡色強調背景 |
| background | `#FFFBF5` | page bg |
| secondary | `#FAF4EA` | card / section surface |
| tertiary | `#F2EAD9` | recessed surface、input bg |
| foreground | `#2A1F18` | 主要文字 |
| muted | `#6F5A47` | 次要文字 |
| border | `#EADFCF` | hairline |
| line-strong | `#C8B89F` | 強分隔線 |

### Dark Mode (Terracotta Dark)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#F0935E` | 深色模式主 accent |
| accent-deep | `#D97848` | hover / pressed |
| accent-subtle | `#3A2418` | hover、selected row |
| accent-bg | `#4A2D1C` | badge、淡色強調背景 |
| background | `#1C140F` | page bg |
| secondary | `#26201A` | card / section surface |
| tertiary | `#332A22` | recessed surface、input bg |
| foreground | `#F5EBDC` | 主要文字 |
| muted | `#B5A08A` | 次要文字 |
| border | `#3A3127` | hairline |

### Semantic Colors
| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| destructive | `#C13515` | `#E8A0A0` | 刪除、錯誤 |
| success | `#06A77D` | `#7EC89A` | 成功、確認 |
| warning | `#C88500` | `#E8B556` | 警告 |
| info | `#3B7EA1` | `#8FB8D1` | 資訊提示；不用 terracotta，避免和 CTA 混淆 |

### Stop Type Color Convention
設計稿「一個 accent」原則：**只有 sight（景點）、food（用餐）**用 terracotta accent，其餘類型（flight/hotel/walk/drive/shop/rest）一律用 ink（`foreground`）。這讓 accent 保有「重點」的訊號意義，不會過度使用而失焦。

### Data Visualization 例外

「單一 terracotta accent」原則有 **data visualization 例外**：地圖 polyline、chart series、時間軸 day separator 等 semantic encoding 可用 10 色 qualitative palette（Tailwind `{sky,teal,amber,rose,violet,lime,orange,cyan,fuchsia,emerald}-500`）。UI chrome（button、text、icon、active state）仍嚴守 terracotta。

**地圖 chrome 子例外：** 在地圖相關頁面（`MapPage`、`TripMapRail`、`OceanMap`）的 **Day 指示 tab active state**（底線色、eyebrow `DAY NN` 文字色），可套用 `dayColor(N)` 作為 visual cueing，與 polyline 同色呼應。適用範圍僅限 Day 指示 tab；其他 chrome（返回鈕、主導航、title、overflow menu）仍嚴守 terracotta。

### 地圖 Polyline 規格（含飯店）

**hotel 是當日 polyline 的起點，必須入線。** 飯店在 timeline 中是出發地（早上從這裡走到第一個 entry）。視覺上飯店圖標若不連上第一條線段，使用者會誤以為「沒有起點」或「飯店是孤立 POI」。

規則：

- **每 day 一段獨立 polyline**：以該日 `pinsByDay.get(N)` 的全部 pins（hotel + entries）按 `sortOrder` 串接。`extractPinsFromDay` 已把 hotel 排在 `sortOrder` 最小（index=0），自然成為線首。
- **跨 day 不連線**：避免「飯店 A → 餐廳 → 飯店 B」這種視覺上不合理的長線。
- **單 trip 內 polyline 同色**：在 `OceanMap` 是單 trip 的 dayColor(N) 漸層；在 `GlobalMapPage`（cross-trip）每 trip 一個顏色，當天的線段共用該 trip 的色。
- **hotel marker 樣式不變**：仍用 ink 類 stop 顏色（per Stop Type Color Convention），只有 polyline 把它包進來。
- **hotel 缺座標時**：略過該日線首的 hotel 段，從第一個 entry 開始接，不報錯。

實作位置：`OceanMap`（per-trip overview）、`GlobalMapPage`（cross-trip 全域）。`MapPin.type === 'entry'` 不再做 polyline 的入線過濾條件 — 改用 day-grouped 全 pins。

## Spacing

### Base Unit
4px grid — 所有間距為 4 的倍數。

**Micro-spacing 例外**：chip / pill / icon-button 的 inner padding 可用 `6 / 10 / 14 / 18px` 等非 4-grid 值，因為這些元素的 typography（11-13px font + line-height）需要 fine-tuned padding 達到視覺均衡，硬套 4-grid 反而 padding 過鬆或過緊。例外限定 inner padding，外層 gap / margin 仍守 4-grid。

### Scale
| Token | Value | 用途 |
|-------|-------|------|
| half | 2px | 微調 |
| 1 | 4px | 最小間距 |
| 2 | 8px | 元素內 padding、titlebar gap |
| 3 | 12px | 小間隔、titlebar vertical padding |
| 4 | 16px | 標準 padding（= padding-h） |
| 5 | 20px | hero 內 padding（mobile） |
| 6 | 24px | section gap、body grid gap |
| 8 | 32px | hero horizontal padding（desktop） |
| 10 | 40px | desktop chrome horizontal padding |
| 12 | 48px | nav 高度 |
| 16 | 64px | 極大間隔 |

### Key Layout Measurements
| Token | Value | 用途 |
|-------|-------|------|
| padding-h | 16px compact / 24px desktop | 標準頁面水平 padding |
| tap-min | 44px | 最小觸控目標（Apple HIG） |
| page-max-w | 1440px | 桌面頁面最大寬 |
| content-max-w | 1040px | 一般內容頁最大寬度；地圖頁例外可 full bleed |
| info-panel-w | 320px | 桌面版側邊資訊欄參考寬度 |
| titlebar-h | 64px desktop / 56px compact | sticky page header 高度 |
| bottom-nav-h | 72-88px | compact bottom nav 高度，含 safe-area padding |
| day-chip-w | 160px | Day chip 寬度（desktop）、140/130 遞減 |
| stop-time-col | 68px | stop card 時間欄寬 |
| stop-icon-box | 48px | stop card icon 方塊（desktop） |
| fab-size | 56px | QuickPanel FAB |

## Layout

### Unified App Shell
- **Primary IA:** 聊天 / 行程 / 地圖 / 收藏 / 帳號。Desktop sidebar 將帳號呈現在底部 account chip；compact bottom nav 保留帳號 tab；匿名狀態顯示登入入口。「探索」自 v2.21.0 起降為 `/favorites` 頁右上 secondary action（ghost variant），保留路由 `/explore` 為次要 entry。
- **Desktop shell:** sticky left sidebar + sticky page titlebar + standard centered content column。
- **Compact shell:** sticky page titlebar + right-side hamburger menu + bottom nav。底部導航向下捲動隱藏、向上捲動顯示。
- **Header rule:** 所有主功能頁 titlebar 一律 sticky；桌機與 compact 都是單行標題，不放 eyebrow、meta、helper text。
- **Map exception:** 地圖頁可 full bleed，仍保留統一 sidebar / titlebar / bottom nav 行為。
- **Trip detail DayNav:** sticky 在 titlebar 下方，行為與 bottom nav 一致：向下捲動隱藏、向上捲動顯示。
- **Trip detail source:** 行程明細頁 desktop / compact 必須共用同一個內容結構與狀態來源；只允許外層 layout responsive，避免兩套明細頁造成行為與 UI 漂移。

### Content Width
- **Standard pages:** content wrapper `max-width: 1040px; margin-inline: auto; padding-inline: 24px` on desktop。
- **Compact pages:** full width + `16px` horizontal padding，並保留 bottom nav safe-area padding。
- **Avoid page-local widths:** chat / itinerary / explore / account 不再各自使用 `720/920/960px` 外層寬度；局部卡片或表單可在內部自行限制。
- **Map pages:** 地圖 canvas 和 map tool surface 例外，可占滿 shell available width。

### Responsive Model
| Mode | Rule | 版型 |
|------|------|------|
| compact | default | 手機與平板共用：titlebar + hamburger + bottom nav |
| desktop | `@media (min-width: 1024px) and (pointer: fine)` | 桌機：左側 sidebar + 無 bottom nav |

不再維護 tablet-specific 斷點。任何不是 `min-width: 1024px` 且 `pointer: fine` 的環境都走 compact。

### Border Radius
| Token | Value | 用途 |
|-------|-------|------|
| xs | 4px | input、極小元素 |
| sm | 6px | 按鈕、小 icon box |
| md | 8px | 卡片（stop card、side card）、day chip |
| lg | 12px | hero、sidebar card |
| xl | 16px | 大型 panel（day-header fallback） |
| full | 9999px | FAB、pill |

## Material & Effects

- **Glass:** Titlebar、bottom-nav、sheet 統一使用 `backdrop-filter: blur(14px)`（`--blur-glass: 14px`）。三層 glass 元素保持一致強度，避免不同 blur 強度造成視覺雜亂。Sheet 不加 `saturate(1.8)` — 對齊 editorial clean direction，去除色飽和增強。不再給 timeline card 用（設計稿強調乾淨、無模糊）。**Small floating button 例外**：≤32px 的浮動按鈕（POI photo 上的 `+ 加入` / `⋯` menu / `❤ 收藏 toggle`）可用 `blur(6px)` — 14px blur 在小元素上會 over-soften 邊緣，6px 給更 proportional 的玻璃感。
- **Shadow specialized 例外**：地圖 markers 的 active state ring + drop shadow 可用 inline 多層 shadow（如 `0 0 0 4px rgba(217,120,72,0.3), 0 4px 12px rgba(42,31,24,0.45)`），因為 marker 浮在地圖背景上需要更強對比，token 三層 shadow 過弱。例外限定地圖 marker，其他 UI 一律用 token。
- **Shadow scale（Airbnb 三層）：**
  | Token | Value | 用途 |
  |-------|-------|------|
  | sm | `0 1px 2px rgba(0,0,0,0.04)` | 微妙抬升（input、chip） |
  | md | `0 6px 16px rgba(0,0,0,0.08)` | 卡片 |
  | lg | `0 10px 28px rgba(0,0,0,0.12)` | 浮層、toast、sheet |
- **Focus ring:** `0 0 0 2px accent` — 鍵盤導航可見性
- **Hairline borders:** `1px solid #EADFCF`（light）/`1px solid #3A3127`（dark）取代重邊線。卡片區分用 border 而非 shadow。

## Motion
- **Approach:** Intentional — Apple 風格流暢動效，不花俏但有質感
- **Easing:**
  - Apple curve: `cubic-bezier(0.2, 0.8, 0.2, 1)` — 標準 UI 過渡
  - Spring: `cubic-bezier(0.32, 1.28, 0.60, 1.00)` — sheet 開啟、彈性效果
  - Sheet close: `cubic-bezier(0.4, 0, 1, 1)` — 快速收合
- **Duration scale:**
  | Token | Value | 用途 |
  |-------|-------|------|
  | tap | 80ms | 按壓回饋 |
  | fast | 150ms | 微互動（toggle、hover、day chip） |
  | nav-fade | 200ms | 導航元素淡入淡出 |
  | normal | 250ms | 標準過渡 |
  | slow | 350ms | 入場動畫、skeleton |
  | sheet-close | 280ms | sheet 收合 |
  | indicator | 350ms | 指示器移動 |
  | sheet-open | 420ms | sheet 展開 |

## Components

### Page Titlebar（`TitleBar`）

唯一 page chrome primitive。所有 page（主功能 / settings 子頁 / form 全頁）皆用 `<TitleBar>`。

**幾何**
- Desktop ≥761px: height 64px / padding 0 24px / title 20px / 700
- Compact ≤760px: height 56px / padding 0 16px / title 18px / 700
- Sticky top 0 + glass blur 14px + 1px bottom hairline border
- Title ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)

**結構**
- 主功能 root (`/chat` `/trips` `/map` `/favorites` `/account`):
  - 左側: 無 back button
  - 中間: page identity (「聊天」/「行程」/「地圖」/「收藏」/「帳號」)
  - 右側: optional action (e.g.「+ 新增行程」/「探索」)。`/favorites` 頁右上 = `.tp-titlebar-action` ghost variant 「探索」（icon: search）→ navigate `/explore`。
- 第二層 (form 全頁 / settings 子頁 / collab):
  - 左側: 36×36 chevron-left back button + `aria-label`
  - 中間: page identity (「編輯行程」/「加景點」/「共編設定」)
  - 右側: optional primary confirm action (「儲存」/「完成」)

**Action button (`.tp-titlebar-action`)**
- 唯一合法 class，禁止自製 ad-hoc class
- **Ghost icon button family**：無 border、透明底、hover 出 `--color-hover` + accent text。對齊 Apple HIG / iOS toolbar 慣例，跟 `.tp-titlebar-back` 同 family。
- 兩 variant: default ghost / `.is-primary` accent filled (CTA 強調用，Tracerocta 實心)
- 桌機: rounded rect (radius-md 8px) + icon + 文字 label
- 手機: square 44×44 + radius-md + icon-only (label hidden via `.tp-titlebar-action-label` @media)
- 44×44 min tap target
- 多 action 水平排列, `.tp-titlebar-actions` wrapper, gap 6px

**Button family radius 統一規則**
所有 TitleBar button (含返回 / icon trigger / action) **一律 radius-md (8px)** — 不用 radius-full pill。

**全 TitleBar button class** (都 ghost、無 border、44×44 min tap)
- `.tp-titlebar-back` — 左側返回 button, 44×44 ghost icon
- `.tp-titlebar-action` — 右側 action (icon + 文字 / mobile icon-only)，可加 `.is-primary` 變實心 accent CTA
- `.tp-titlebar-icon-btn` — OverflowMenu kebab trigger, 44×44 icon-only ghost
- `.tp-titlebar-trip-picker` — Chat/Map「切換行程」 picker, ghost icon + text，radius-full（pill shape 因為 picker 內部 chevron + truncation 視覺需要 — 唯一例外）
- 漢堡選單 (TripsListPage embedded EmbeddedActionMenu) 直接複用 `.tp-titlebar-action`，不再有獨立 `.tp-embedded-menu-trigger` class

**Sub-content 規則 (TitleBar 下方)**
- eyebrow + meta: 用 `.tp-page-eyebrow` + `.tp-page-meta` inline 在 TitleBar 下方第一行 (settings/list page 資訊密度需求)
- Sub-toolbar (DayNav, day tab strip 等): 可緊貼 TitleBar 形成 sticky chrome group, 但須是獨立 sticky element 不影響 TitleBar height
- Content section: 16-24px top buffer

**Layout container 規則 (parent of `<TitleBar>`)**
- 用 grid `grid-template-rows: auto 1fr` (chrome auto + main 1fr) 為標準 pattern
- 或 flex column + content child 明確 `flex: 1 1 0` 撐滿剩餘空間
- 不可 flex column without explicit child flex behavior — 會 squeeze TitleBar 到 children min-size

### Desktop Sidebar（`DesktopSidebar`）
- 只在 desktop mode 顯示。
- Primary nav 順序固定：聊天 / 行程 / 地圖 / 收藏。登入只在匿名狀態顯示；已登入帳號入口固定在底部 account chip，避免 desktop 同時出現帳號 nav + account chip。
- DesktopSidebar 與 GlobalBottomNav 第 4 slot 統一「收藏」label（v2.22.0 後）。ownership 語意由 `PoiFavoritesPage` hero eyebrow（「我的收藏」+ count）補回，不靠 nav text。原 asymmetric labels（sidebar「我的收藏」/ bottom「收藏」）已廢除 — 5-tab 緊密度與 desktop nav 文字皆從 hero 取得 context。
- Auth loading 不預設成匿名狀態：userinfo 尚未 resolve 時，sidebar 維持 4 個 primary nav，底部只保留 neutral loading chip；不得先顯示「登入」「未登入」或 account chip 後再切換。
- 背景固定深棕：light `#2A1F18`；dark `#0F0B08`。不得使用 `--color-foreground` 當背景，因為 dark mode 會反轉成淺色文字 token。
- Active state 用 terracotta accent；其餘用 cream `rgba(255,251,245,.78)`。
- `/trip/:id/map` 與 `/trip/:id/stop/:eid/map` active item = 地圖；其他 `/trip/:id/*` active item = 行程。
- 不和 page titlebar 重複放頁面說明文字。

### Compact Bottom Nav（`GlobalBottomNav` / `BottomNavBar`）
- 只在 compact mode 顯示，IA 與 desktop sidebar 同步。
- 向下捲動隱藏，向上捲動顯示；所有頁面使用同一套 scroll direction state。
- 高度需包含 safe-area inset，頁面內容必須留出底部 padding。
- Bottom nav 是主功能定位，不是 breadcrumb。子頁與明細頁 active item 依所屬主功能決定，不新增子頁 tab。
- Active item 使用不同於 CTA 的定位樣式：terracotta 淡底 pill + 2px top indicator + accent icon/label；inactive 保持 muted。

| Route family | Active bottom nav |
|--------------|-------------------|
| `/chat`、聊天明細 | 聊天 |
| `/trips`、行程列表、行程明細、新增行程 | 行程 |
| `/map`、行程地圖、全域地圖 | 地圖 |
| `/favorites`、`/favorites/:id/add-to-trip` | 收藏 |
| `/explore`、探索結果、POI 詳細 | 收藏（active 同步「收藏」，via `additionalActivePatterns: [/^\/explore/]`）|
| `/account`、connected apps、developer apps | 帳號 |

### Day Nav (Trip Detail + Map page 共用視覺)

Trip detail 與 Map page 共用同一個 underline tab primitive — `<MapDayTab>` 元件 + `.tp-map-day-tab*` CSS family。Trip detail 透過 `<DayNav>` wrapper 加上 sticky modifier；MapPage 直接用 plain wrapper（黏在底部 card-rail 上方）。

**Tab 規格 (`.tp-map-day-tab`)**
- text-only (eyebrow + date)，無 chip background fill / border
- Eyebrow: `DAY 01` — **Map page** 套 per-day color (`dayColor(dayNum)` from `src/lib/dayPalette` — 10-tone Tailwind -500 palette)；**Trip 明細頁** 不傳 `dayColor` prop，用 default token (idle muted, active accent)
- Date: 14px / 600 weight, `color-foreground` (active 套 accent color)
- Active state: 2px `border-bottom`-color — **Map page** 用 `--day-color` inline override (per-day color underline)；**Trip 明細頁** 用 `var(--color-accent)` (Terracotta 單色)
- Idle: muted text + transparent border-bottom
- Hover (idle): `color-foreground`
- 36px min height (扁平 strip — 不搶佔垂直空間，對齊 mockup S20)
- Today marker: eyebrow 文字後綴「· 今天」（不是另一個 pill）

> **Day color 規範**：Map page 內 chrome (day strip eyebrow + underline + entry card num + entry card eyebrow) 套 dayColor 服務於「N 條 polyline 視覺區分」需求；Trip 明細頁 chrome 嚴守 Terracotta 單色 accent — 多色不溢出地圖 context。詳見上方「Day palette exception」。

**Strip container (`.tp-map-day-tabs`)**
- 共用 wrapper：horizontal scroll + scrollbar hidden + glass blur 14px
- Trip detail 加 modifier `.tp-map-day-tabs--sticky`：position: sticky, top: 64px (desktop) / 56px (compact)，緊接 TitleBar 形成 sticky chrome group，僅加底邊 hairline（不加水平 mask 漸層 — 視覺干擾）
- 錨點 #dayN 跳轉：`.ocean-hero { scroll-margin-top: 110px (desktop) / 100px (compact) }`，避免目標被 sticky chrome 蓋住
- TripPage 的 `.ocean-page` 桌機 top padding = 0（讓 sticky day strip 緊貼 TitleBar 無空隙）；mobile 已是 0
- MapPage 不用 modifier：top border 當作底部 card-rail 上邊界，自然 stack 在頁面 flex column
- TripPage 內 `<TitleBar>` 已 sticky top:0，`<DayNav>` 設 top:64/56px → 兩者凍結頂部成 sticky chrome group

### Trip Detail Page
- Desktop / compact 共用同一份 `TripDetail` 內容樹：DayNav、stop list、住宿、交通、地圖摘要、錯誤訊息、空狀態都不可拆成兩套邏輯。
- Desktop 只增加 sidebar、較寬 content、可選的輔助欄；compact 只改成單欄、hamburger、bottom nav。
- 所有資料來源、mutation、loading/error state 必須共用，確保手機與桌機功能一致。

### Form Pages

複雜 form 流程必走全頁 + TitleBar shell，不用 modal。

**Routes**
- `/trips/new` — 建新行程
- `/trip/:id/edit` — 編輯行程
- `/trip/:id/add-stop?day=N` — 加景點
- `/trip/:id/stop/:eid/(copy|move)` — 複製/移動景點到其他日
- `/developer/apps/new` — 建 OAuth client

**Page 結構**
- Shell: AppShell (sidebar desktop / bottom nav compact)
- Titlebar: sticky `<TitleBar>` + 返回 + 單行標題 + 右側 primary action
- Content: form-first single-column, `max-width: 1040px`
- 取消/送出 actions: TitleBar primary action + bottom sticky bar (取消 / 確認) 對稱
- Mobile: full-width, page bg (不是 backdrop overlay)
- Desktop: content max 1040px 置中

**禁止**
- Modal backdrop / portal 浮層
- 大型 split hero / 形象圖
- Loading 蓋住 page (改用 `<PageErrorState>` 或 inline skeleton)

### Stop Card
- 4-col grid：`68px time | 48px icon box | content | actions`，compact 可收斂到 3-col。
- Background + hairline border + 8px radius + hover → terracotta border。
- Icon box 白底 + hairline，sight/food 用 terracotta accent border + icon color。
- `data-now="true"` → terracotta border + shadow-md；`data-past="true"` → opacity 0.65。

### Travel Connector
- Stop 之間的交通段，左側 2px dashed terracotta border + icon + text。
- 縮排 34px（對齊 stop 內 icon box 左緣）。

## Modal Dialogs

### Principle

**禁止使用 native browser dialog**（`window.confirm` / `window.alert` / `window.prompt`）—
無法 style、無法 a11y trap focus、阻塞主執行緒、Mac/Windows 視覺差異大、看起來「不像我們的 app」。所有互動式對話必須走 styled modal 或 Toast。

### Modal vs Full Page Decision

**Modal 限定情境**
- Confirm: destructive action 二次確認 (`<ConfirmModal>`)
- Input: 單行輸入 (`<InputModal>`)
- Popover / Menu: 浮層選單 (kebab, anchored picker)
- Critical attention: 一次性 client-side state (e.g. OAuth secret reveal, server response 不可重取)

**必走全頁 (form 全頁 + TitleBar shell) 情境**
- 多欄位 form (>3 fields, 含 select / segment / toggle / textarea)
- Sortable list / drag-to-reorder
- Inline search dropdown (POI search, autocomplete)
- 巢狀 form section
- Loading + 主內容並存雙態介面
- Day picker / time slot select + confirm 流程 (即使 popover-shaped)

**Chooser 流程 (selection → 立即 navigate)**
- 用 anchored popover (跟 region pill / category subtab 同 pattern)
- 不走全頁 (page mode 打斷 selection-then-action flow)
- 不走 modal-style backdrop

**判斷準則**
- User 可能想用 browser back 鍵取消 → 全頁
- 想 deep-link 給隊友看「我在這個畫面」 → 全頁
- Selection 後立即 navigate → popover
- 需要用戶顯式 OK / Cancel 的瞬間阻斷 → modal

**禁止**
- Native browser dialog (`window.confirm` / `window.alert` / `window.prompt`)
- 自製 modal backdrop (一律用 `<ConfirmModal>` / `<InputModal>`)

### Allowed Modal Components

| Component | 用途 |
|---|---|
| `<ConfirmModal>` | Destructive 確認 (刪除 / 撤銷 / 登出) |
| `<InputModal>` | 單行 input |
| `<ConflictModal>` | Sync 衝突決策 |
| `<TripCardMenu>` | Kebab popover menu |
| `<StopLightbox>` | 圖片燈箱 |
| `<TripPickerPopover>` | Chooser popover (anchored, 不全頁) |

### Surface 對應表

| Situation | Surface | Component |
|-----------|---------|-----------|
| Destructive 確認（刪除 / 撤銷 / 登出全部裝置 / 移除共編） | ConfirmModal (`role="alertdialog"`) | `<ConfirmModal>` |
| 單行 input prompt（輸入地區名 / 自訂值 / 備註） | InputModal (`role="dialog"`) | `<InputModal>` |
| 環境狀態 / 低風險通知（離線 / 複製成功 / 不支援的功能 / 操作失敗可重試） | Toast | `showToast()` / `showErrorToast()` |

當你在猶豫時：**需要 user 顯式決定 → Modal；passive 通知 → Toast**。

### ConfirmModal

`src/components/shared/ConfirmModal.tsx`

- Role: `alertdialog`（語意上要求 user 注意）
- Title `<h2>` + message `<p>` + 兩個 button：取消 ghost / 確認 destructive 實心
- Confirm button 自動 focus（keyboard user 直接 Enter）
- Escape / backdrop click / cancel button 都關閉
- `busy` prop：confirm button 顯示「處理中…」+ disabled，避免 double-submit
- Destructive button 顏色 = `--color-priority-high-dot`（不用 terracotta accent）

### InputModal

`src/components/shared/InputModal.tsx`

- Role: `dialog`（不是 alertdialog，純收 input 不阻斷）
- Title + optional message + 單行 `<input>` + 兩個 button
- Input 自動 focus + 全選 default value（user 直接覆蓋輸入）
- Enter 提交 / Escape 取消 / backdrop dismiss
- 空字串自動 disable 確認 button，除非 `allowEmpty`
- Confirm button 用 `--color-accent`（非 destructive，不用紅）

### Visual Spec（兩者共用）

| Property | Value |
|---|---|
| Backdrop | `rgba(20, 14, 9, 0.42)` + portal to `document.body` |
| Modal width | `min(420px, 100%)` |
| Border radius | `--radius-xl` |
| Shadow | `--shadow-lg` |
| Backdrop animation | 150ms fade-in |
| Modal animation | 200ms slide-up + scale (98% → 100%) |
| Button radius | `--radius-full` (pill) |
| Button min-height | 44px (Apple HIG tap target) |
| Cancel button bg | `--color-secondary` + 1px `--color-border` |
| Cancel hover | `--color-hover` |
| Confirm focus ring | 2px outline + 2px offset |

### Examples (現役)

- TripsListPage card kebab「刪除」 → ConfirmModal
- PoiFavoritesPage 收藏批次「刪除」 → ConfirmModal（DUC1: delete-only batch flow，user accept；不支援 batch add-to-trip）
- ExplorePage region pill「+ 自訂地區…」 → InputModal
- AddPoiFavoriteToTripPage 同 day 同時段衝突 → ConflictModal（new component, v2.21.0）
- SessionsPage「登出其他全部裝置」 → ConfirmModal
- CollabPanel 移除成員 / 撤銷邀請 → ConfirmModal
- TimelineRail 刪除景點 → ConfirmModal

### Toast

詳見 [Error & Status Messaging](#error--status-messaging) — Toast 規範統一管在那。

## Error & Status Messaging

### Principle

Toast 只用於環境狀態與低風險通知，例如離線、恢復連線、複製成功。其他錯誤必須使用更明顯、持續可見、可操作的 surface，避免使用者漏看儲存、登入、資料載入等重要問題。

### Surfaces

| Situation | Surface | Behavior |
|-----------|---------|----------|
| 欄位格式錯 | `FieldError` + optional form summary | 顯示在欄位下方；送出後表單頂部可列出 summary |
| 表單送出失敗 | `FormErrorBanner` | 表單頂部 persistent banner，不自動消失 |
| 儲存失敗 | Section-level persistent alert | 放在受影響區塊上方，保留使用者輸入並提供 retry |
| 刪除 / 邀請 / 登入等重要操作失敗 | Dialog 或 compact bottom sheet | 明確阻斷，提供修復 action |
| 頁面資料載入失敗 | `PageErrorState` | 占用內容區，提供 retry / back action |
| 地圖資料失敗 | Map floating error panel | 浮在地圖上方，不被 bottom nav 擋住 |
| 登入過期 / 權限不足 | Global banner under titlebar | persistent，必要時阻擋操作並引導重新登入 |
| 離線 / 恢復連線 | Toast | Desktop 右上 titlebar 下方；compact 底部且高於 bottom nav |
| React runtime crash | Error boundary fallback | 頁面或局部 fallback，提供重新整理與回報入口 |

### Visual Style

- Error surfaces 使用 semantic error，不使用 terracotta。Terracotta 保留給品牌、active state、CTA。
- `error`: `#C13515`；`error-bg`: `rgba(193, 53, 21, 0.08)`；border 可用 `rgba(193, 53, 21, 0.24)`。
- Warning 使用 `#C88500`；info 使用 `#3B7EA1`；success 使用 `#06A77D`。
- Persistent alert panel：8px radius、1px hairline border、左側 4px 狀態色條、icon / title / message / action。
- 不用大面積實心紅底；錯誤要明顯，但不要破壞 Terracotta editorial 風格。
- Mobile action 可換行到下一列，避免按鈕擠壓文字。

### Copy Rules

錯誤文案必須回答三件事：

1. 發生什麼事。
2. 使用者現在可以怎麼做。
3. 系統是否保留資料。

範例：

- `行程沒有儲存成功。你的內容還在，可以再試一次。`
- `登入已過期。請重新登入後繼續編輯。`
- `地圖資料載入失敗。行程內容仍可瀏覽，請稍後重試地圖。`

避免空泛文案，例如 `發生錯誤`、`Something went wrong`、`請稍後再試` 單獨出現。

### Components

- `FieldError`
- `FormErrorBanner`
- `PersistentAlert`
- `GlobalStatusBanner`
- `PageErrorState`
- `MapErrorPanel`
- `StatusToast`
- `ErrorBoundaryFallback`

## Icons
- **Approach:** Inline SVG 元件系統（`src/components/shared/Icon.tsx`）
- **Size:** 跟隨 font-size（`width: 1em; height: 1em`）
- **Style:** Line stroke 1.5-1.75px，不用填充
- **Color:** 繼承 `currentColor`

## Accessibility
- **Touch target:** 最小 44×44px (Apple HIG)
  - Exception: drag handles (e.g. `.ocean-rail-grip`) 24×24px — 跟 row 主點擊區並存時避免 click target 衝突，以 `:focus-visible` ring + 持續可見 opacity 補 a11y
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（muted text `#6F5A47` / dark `#B5A08A` 需持續驗證）
- **Focus:** 所有互動元素有 focus-visible ring
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks + `role="tab"` 在 day chips

## V2 Owner Cutover & poi_favorites Universal Pool（migration 0046+0047+0050）

> **Naming history**：v2.22.0 (migration 0050) `saved_pois` table → `poi_favorites`, `/saved` route → `/favorites`, `/api/saved-pois` → `/api/poi-favorites`, `SavedPoisPage` → `PoiFavoritesPage`, `AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`. Hard cutover, no aliases. 下方規範皆已對齊新名稱。

「備案」概念退場，所有「想去但沒進行程」的景點統一進「收藏」(`poi_favorites`)，
跨 trip universal pool。trip ownership identity cutover 同步走完
email → user_id 完整切換。

### poi_favorites universal pool

- **單一收藏池**：每個 user 一個 `poi_favorites` 池。`(user_id, poi_id)` UNIQUE — 不能重複收藏同 POI。
- **跨 trip 反查**：透過 `poi_favorites.poi_id ← trip_pois.poi_id` JOIN，每筆收藏即時可知「目前在哪些 trip / 哪天 / 哪 entry 出現」。後端 GET 用 `json_group_array` 一次查（避 N+1），usages 隨收藏 POI row 一起回。
- **「目前在 N 個行程」徽章**：收藏 POI card 在 POI 名稱下方加一行 `--font-size-footnote --color-muted` 文字，內容例「目前在 3 個行程」。N=0 時不渲染（避免「0 個行程」噪音）。
- **進行程不刪收藏**：「搬」 = 複製；poi_favorites 是「跨 trip 願望清單」，進行程不代表不想再去（同景點可能不同 trip 都想去）。

### 加入行程 fast-path（route `/favorites/:id/add-to-trip`）

**Page (full)，不是 modal** — DESIGN.md L390-414 form 規範：>3 fields + select + time picker 必走全頁。檔名 `AddPoiFavoriteToTripPage.tsx`。

**Form fields (4，純時間驅動)** — v2.22.0 起改 4-field schema，移除 position radio + anchorEntryId（mockup v4 sign-off）：
1. trip dropdown（user 只 1 個 trip 自動選）
2. day dropdown（依選定 trip 動態載入 days）
3. start time（可空，依 POI type 推 — restaurant 12:00 / attraction 10:00 / hotel 15:00）
4. end time（可空，預設 = start + stay duration heuristic）

**插入位置**：server 依 startTime 自動排在 day 內第一個更晚 entry 前；無更晚 entry → append。client form 不再選 position。

**Stay duration heuristic by POI type**（同 server）：
- restaurant: 90 min
- shopping: 60 min
- attraction: 120 min
- parking: 15 min
- transport: 30 min
- activity: 90 min
- hotel: overnight (special)
- other: 60 min

**Endpoint**：`POST /api/poi-favorites/:id/add-to-trip`。Fast-path REST，**不走** message-based tp-request — 避免 LLM 8 秒等待感。`travel_*` 欄位 NULL，背景 tp-request 之後 fill。UI 顯示「計算車程中…」placeholder。

### 7-state spec（form 必須涵蓋）

| State | UI | Pattern |
|-------|----|---------|
| **loading** | tp-skel skeleton 3 rows | 同 ChatPage / TripsListPage skeleton |
| **empty (no trip)** | `tp-empty-cta` block + 「建立第一個行程」 link | dashed border + accent CTA |
| **conflict (同 day 同時段)** | reuse ConflictModal pattern | 標 v2.20.1 polish |
| **error (網路/5xx)** | tp-error block (PersistentAlert pattern) | 不用 toast — error 必持久可行動 |
| **success** | navigate to `/trips?selected=:id&day=N&saved_added=1` | 後續 toast 由 TripsListPage handle |
| **optimistic** | submit button busy + label「加入中…」 + disable 防重 click | Apple HIG progress |
| **partial (saved 載到、trips 空)** | empty CTA branch | 同 empty |

### V2 owner identity（email → user_id cutover）

- **canonical id**：`auth.user_id`（V2 session.uid / Bearer tokenRow.user_id）
- **dual-read transition**：`hasPermission` / `hasWritePermission` SQL 同時匹配 email + user_id（`WHERE email = ? OR user_id = ?`），SQLite NULL 語意保護 service token / pre-V2 session。
- **dual-write transition**：所有 write path 同寫 email + user_id 雙欄位（trips.owner + owner_user_id, saved_pois.email + user_id, trip_permissions.email + user_id）。註：v2.22.0 (migration 0050) 後 `saved_pois` 已 rename 為 `poi_favorites`，本段為 v2.21.0 phase 1 歷史描述。
- **Phase 2 cutover (migration 0047)**：drop `saved_pois.email` / `trip_permissions.email` / `trips.owner`（email column）+ UNIQUE constraint 改 `(user_id, poi_id)` / `(user_id, trip_id)`。runbook 強制 manual gate 確認 prod soak 後執行。

### v2.21.0 IA Reshuffle — PoiFavoritesPage 升 primary nav

> **v2.22.0 rename**：原 `SavedPoisPage` / `/saved` 已 rename 為 `PoiFavoritesPage` / `/favorites`（migration 0050）。下方規範已對齊新名稱與 mockup v4 sign-off（2026-05-04）。

「收藏」自 v2.21.0 升為第 4 個 primary nav slot（取代「探索」）。`PoiFavoritesPage` 為獨立 route `/favorites`，從 ExplorePage L887-1011 saved-view section 抽出且擴展為 top-level 頁面。

**PoiFavoritesPage 規格**

| Slot | Content |
|------|---------|
| TitleBar | 中=「收藏」（per L298 統一 label，ownership 語意由 hero eyebrow 補回）, 右=「探索」`.tp-titlebar-action` ghost variant (icon: search) → navigate `/explore` |
| Hero | `tp-page-eyebrow`「我的收藏」+ count meta「N 個收藏 POI」+ region pill row（`role="group"` + `aria-pressed`，reuse ExplorePage L470-885 邏輯）+ type filter row（餐廳 / 景點 / 飯店 / 購物 / 其他）+ search-within-favorites (`<input type="search">` client-side filter，200+ POIs 必須能搜) |
| Body | 收藏 POI grid + 「目前在 N 個行程」usage badges + per-card「加入行程 →」link to `/favorites/:id/add-to-trip` |
| Batch toolbar | sticky bottom toolbar（multi-select 啟動時顯示）：「全選 / 取消 / 刪除」三 action — **不支援 batch add-to-trip**（per-card link 才是加入行程入口，batch 僅刪除） |

**Batch flow（DUC1 sign-off — delete-only）**

- per-card：永遠顯示「加入行程 →」link（單一 add-to-trip 入口）
- multi-select 模式：點 card checkbox 觸發 → sticky bottom toolbar 顯示 → 僅「全選 / 取消 / 刪除」三 action
- 為何不支援 batch add-to-trip：每筆收藏的 day / startTime / endTime 必為個別決策，batch 強迫一致會破壞 form 純時間驅動 schema（4 fields）

**8-state matrix（必涵蓋，replaces 原 5-state）**

| State | UI |
|-------|----|
| loading | `tp-skel` 3-card grid skeleton |
| empty-pool | `tp-empty-cta` block + 「還沒有收藏。去探索找景點」 CTA → `/explore` |
| filter-no-results | hero filters + body 「目前的篩選沒有符合的收藏」+ 「清除篩選」secondary action |
| error | `PageErrorState` + retry button (fetch /api/poi-favorites 失敗) |
| data | grid + usage badges + per-card add-to-trip link |
| optimistic-delete | 刪除中 card opacity 0.5 + 「移除中…」label + `aria-live="polite"` |
| bulk-action-busy | sticky toolbar 「刪除中 N 筆…」+ 全卡片 disable 防重 click |
| pagination | data 滿 24 筆 → 底部 sticky search 條 + 載入更多 button（200+ POIs 才出現） |

**Viewport breakpoints**

| Viewport | Grid columns | 行為 |
|----------|--------------|------|
| ≥1024px | 3-col | desktop sidebar + content max-width 1040px + 3-col grid |
| 640-1023px | 2-col | compact + 2-col grid |
| <430px | 1-col | phone + 1-col stack |

**Accessibility 規範**

- region pill row + type filter row 用 `role="group"` + 每個 chip `aria-pressed="true|false"`（**不用** `role="tablist"` — 並非 tab 切換語意，是 OR-filter）
- 每個 card 含 checkbox 時，checkbox `aria-label` 形如「選擇『五十嵐拉麵』收藏」（含 POI 名稱不只「選擇」）
- optimistic-delete + bulk-action-busy state 用 `aria-live="polite"` announce 變動
- search input `<input type="search">` + `aria-label="搜尋收藏"`，無 label 時加 visually-hidden label

**ExplorePage 變動（v2.21.0 同 PR）**

- 移除 tab state machine 與 `aria-label="我的收藏"` 殘留 ARIA（screen reader 不再 announce 已不存在的 tab）
- 純探索化（POI search + region pills + 「加入收藏」 heart toggle 仍在）
- 仍 mini-fetch `/poi-favorites` 取 `favoriteKeySet` 維 heart-disable 正確性（無 React Query/SWR，state 各頁獨立）
- TitleBar 右側 action 改 navigate `/favorites`

### Retired / 拔除

- ❌ `trip_ideas` table + `IdeasTabContent.tsx` + `?sheet=ideas` URL pattern
- ❌ tp-request `trip-edit` vs `trip-plan` mode 分流（HuiYun 誤判事件 → 改為依語意行動）
- ❌ tp-request 「修改 vs 諮詢」 intent 分流（同上）
- ❌ ExplorePage 內 saved/search dual-tab（v2.21.0 拆 page，saved 獨立路由）
- ✅ `?sheet=ideas` legacy URL graceful degrade to default tab（不爆）

## Design Principles（開發時參考）
1. **DESIGN.md + design-sessions 是單一來源** — `tokens.css` 是實作；若文件和程式衝突，先更新文件再實作。
2. **Terracotta 單一 accent** — 只有 sight/food、active state、CTA 用 terracotta。其他一律 ink，避免七彩稀釋重點。
3. **Chrome 一致優先** — 聊天、行程、地圖、收藏、帳號的 sidebar / bottom nav / titlebar 行為要一致；desktop 帳號以 account chip 呈現，compact 帳號以 bottom-nav tab 呈現；地圖只例外在內容 full bleed。
4. **內容寬度一致** — 一般頁面統一 `1040px` content max width；局部表單可在內部限寬，但外層節奏一致。
5. **行程明細單一來源** — Desktop / compact 共用同一份內容樹與狀態來源，只讓 layout responsive。
6. **Bottom nav 是主功能定位** — 子頁 active item 依所屬主功能，不把 bottom nav 當 breadcrumb。
7. **錯誤必須可見且可行動** — Toast 只處理離線/恢復連線/低風險狀態；真正錯誤使用 persistent surface。
8. **Hairline over shadow** — 卡片區分優先用 1px border，shadow 只用在浮層（toast、sheet、dialog）。
9. **Tabular numbers everywhere** — 時間、日期、stats 數字強制 `tabular-nums`。
10. **無裝飾元素** — 不用 gradient、emoji、decorative SVG、rainbow 類型色；資訊本身是主角。
