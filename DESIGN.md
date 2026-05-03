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

> **Day palette exception**: 10 色 Tailwind -500（sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald）只用於地圖 polyline + day chip — 對應 Data Visualization 例外，UI chrome 仍嚴守 terracotta 單色。

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
- **Primary IA:** 聊天 / 行程 / 地圖 / 探索 / 帳號（匿名狀態可顯示登入）。
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

### Page Titlebar（`TitleBar` / 舊 `PageHeader`）

**全域規則（2026-05-03 補強）：**
- **Sticky to top + glass + bottom hairline** — 所有主功能頁與子頁共用
- **第二層以下頁面**（非主功能 root，例如 `/trip/:id/edit`、`/trip/:id/collab`、`/trip/:id/add-stop`、settings 子頁）：
  - **左側 36×36 返回按鈕** — chevron-left icon，`aria-label="返回前頁"` 或具體頁名
  - **中間單行標題** — page identity（「編輯行程」、「共編設定」、「加景點」）
  - **右側 action slot** — 該頁主要 confirm action（「儲存」、「完成」），可選
- **主功能頁 root**（`/chat` `/trips` `/map` `/explore` `/account`）：
  - 無 back button（已是 nav root）
  - 標題 = page identity（「聊天」、「行程」等）
  - 右側 action：desktop optional / compact = hamburger menu（覆蓋 settings 入口）

**Action button responsive 規則（2026-05-03，PR #441 收官統一）：**

唯一合法 class = **`.tp-titlebar-action`**（`css/tokens.css` L1321-1383）。所有 page 的 TitleBar 右側 button 用同一個 class，**禁止自製 ad-hoc class**（過去 `.tp-embedded-menu-trigger` 用在 primary action 是違規 → PR #441 修正為 standard class）。

| Breakpoint | Default (outline) | `.is-primary` (accent filled) |
|---|---|---|
| **桌機** ≥761px | pill `radius: full` + `1px border` + icon + 文字 (label 顯示) | 同上但 `bg: var(--color-accent)` + accent 實心 |
| **手機** ≤760px | round `radius: full` + **`1px border`** ✅ + icon-only (label hidden) | 同上 accent 實心 |

- **44×44 min tap target**（mobile `width: var(--spacing-tap-min)`）
- Label hide via `.tp-titlebar-action-label { display: none }` @media compact（CSS class 一致，不需要 component 層 useMediaQuery）
- 多 action 水平排列 with `gap: 6px`（`.tp-titlebar-actions` wrapper）
- **2026-05-03 polish**：mobile **保留 1px border** 對齊桌機 + `.is-primary` family（PR #441 修「mobile 無框 visual gap」issue — user 觀察「行程一覽 vs 行程明細 button 樣式不一致」根因）

**例外**：
- `.tp-titlebar-back` — 36×36 transparent icon-only（左側返回 button，不是 action）
- `.tp-titlebar-icon-btn` — 跟 `.tp-titlebar-action` 同 family 但永遠 icon-only no border（OverflowMenu kebab）
- `.tp-embedded-menu-trigger` — `EmbeddedActionMenu` 內部 kebab trigger（square 36×36 by design），**不可拿來當 primary action**

**幾何（不變）：**
- Desktop 64px height / padding `0 24px` / title 20px
- Compact 56px height / padding `0 16px` / title 18px
- **所有 page TitleBar 同一 height** — 不允許 inline override；TripsListPage 一覽/明細、6 主 page、modal-to-fullpage 5 page、settings 子頁全部同規則。
- Title ellipsis（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`），不推擠 action 區
- Glass: `backdrop-filter: blur(14px)` 對齊 bottom-nav / sheet
- TitleBar action button 內部尺寸用標準 class **不會撐高 chrome**（44×44 < parent 56px）

### Desktop Sidebar（`DesktopSidebar`）
- 只在 desktop mode 顯示。
- IA 順序固定：聊天 / 行程 / 地圖 / 探索 / 帳號。
- Active state 用 terracotta accent；其餘用 warm neutral ink。
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
| `/explore`、探索結果、POI 詳細 | 探索 |
| `/account`、connected apps、developer apps | 帳號 |

### Trip Detail DayNav
- Sticky 在 titlebar 下方，與 bottom nav 使用同一套 hide-on-scroll 行為。
- Day item 可使用 data visualization day color，但外框、文字與 inactive state 仍跟 Terracotta 系統。
- Compact 以水平 scroll + scroll snap；desktop 可保留較寬 chip。

### Trip Detail Page
- Desktop / compact 共用同一份 `TripDetail` 內容樹：DayNav、stop list、住宿、交通、地圖摘要、錯誤訊息、空狀態都不可拆成兩套邏輯。
- Desktop 只增加 sidebar、較寬 content、可選的輔助欄；compact 只改成單欄、hamburger、bottom nav。
- 所有資料來源、mutation、loading/error state 必須共用，確保手機與桌機功能一致。

### Trip Form Pages（取代舊 New Trip Modal，2026-05-03）

**新規則**：所有複雜行程 form 流程走**全頁 + TitleBar shell**，不用 modal。詳見下方「Modal Dialogs > Modal vs Full Page Decision」。

對應 routes：
- `/trips/new` — 建新行程（取代 `NewTripModal`）
- `/trip/:id/edit` — 編輯行程（取代 `EditTripModal`）
- `/trip/:id/add-stop` — 加景點到 timeline（取代 `AddStopModal`）

每個 page 結構：

| 元素 | 規範 |
|---|---|
| Shell | AppShell（sidebar desktop / bottom nav compact） |
| Titlebar | sticky `<TitleBar>` 含返回鍵 + 單行標題（「新增行程」/「編輯行程」/「加景點」）+ 右側 action（儲存 / 完成） |
| Content | `content-max-w: 1040px` 標準內容寬度，form-first single-column |
| 不要 | 大型 split hero / 形象圖、modal backdrop、portal 浮層 |
| Form sticky actions | bottom 64px sticky bar（取消 / 儲存），呼應 modal 時代的 footer pattern |
| Mobile | 全寬，背景 = page bg（不是 backdrop overlay） |
| Desktop | content 1040px 內容欄置中，左 sidebar、右側留白 |
| Loading state | 使用 `<PageErrorState>` 或 inline skeleton，不彈 modal |

**為何改全頁**：
1. **Browser back 自然 work** — 取消 = 上一頁，不需 X close button hack
2. **URL deep-linkable** — `/trips/new` 可從 hint email、書籤直達
3. **多 form section 不被 modal 高度限制** — 9+ 欄位（destinations sortable + day quota stepper + segment + toggle + textarea ×2）modal 在 mobile 撐爆 viewport
4. **Mobile share UX 一致** — 不會出現「modal 佔半屏 + 背後內容隱約透出」的尷尬層次
5. **a11y 簡化** — 不需 focus trap、aria-modal、Escape handler；瀏覽器 native focus 走完即可

### Day Chip（`[data-dn]`）
- 160×auto（compact 140/130）。
- Border hairline，active = terracotta 實心白字；地圖 day indicator 可套 day color 例外。
- 內容三段：`DAY 01` / 日期 / area label。Progress marks 僅在資訊密度需要時使用。

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

### Modal vs Full Page Decision（2026-05-03，明文規則）

**Modal 限定使用情境**：
- **Confirm**: 確認 destructive action（刪除、撤銷、登出）— `<ConfirmModal>`
- **Input**: 單行輸入（rename、自訂值、備註）— `<InputModal>`
- **Popover / Menu**: 浮層選單（kebab menu、entry action popover）

**禁止用 modal 的情境**（必走全頁 + TitleBar shell）：
- ❌ 多欄位 form（>3 欄位、含 select / segment / toggle 等多種 control）
- ❌ Sortable list / drag-to-reorder
- ❌ 含 inline search dropdown（POI 搜尋、自動完成）
- ❌ 巢狀 form section（form 內含 form）
- ❌ Loading + 主內容並存的雙態介面

**判斷準則**：
> 如果 user 可能想用 browser back 鍵取消，或想 deep-link 給隊友看「我在這個畫面」，
> 那就**必走全頁**。Modal 是「需要用戶顯式 OK / Cancel 的瞬間阻斷」，不是「主操作介面」。

詳見「Components > Trip Form Pages」section 對應的 routes / shell 規範。

### Audit（2026-05-03）— 違規 component 對應遷移

| 現況 | 違規原因 | 遷移結果 | 狀態 |
|---|---|---|---|
| ~~`EditTripModal.tsx`~~ (v2.19.0) | 6+ 欄位 + sortable destinations + region change hint + segment + toggle | → `src/pages/EditTripPage.tsx` @ `/trip/:id/edit` (PR #428, v2.19.4) | ✅ 已遷 |
| ~~`NewTripModal.tsx`~~ | 9+ 欄位 + sortable destinations + POI search dropdown + day quota stepper | → `src/pages/NewTripPage.tsx` @ `/trips/new` (PR #429, v2.19.5) | ✅ 已遷 |
| ~~`EntryActionPopover.tsx`~~ | 表面是 popover，實際內含 day picker + time slot select + confirm CTA — 屬「複雜 form 流程」邊緣案例（2026-05-03 重新分類） | → `src/pages/EntryActionPage.tsx` @ `/trip/:id/stop/:eid/(copy\|move)` (PR #430, v2.19.6) | ✅ 已遷 |
| ~~`AddStopModal.tsx`~~ | POI search + 3 tab (search/saved/custom) + region menu + filter sheet + 9 種 form control — audit 最大違規 | → `src/pages/AddStopPage.tsx` @ `/trip/:id/add-stop?day=N` (PR #431, v2.19.7) | ✅ 已遷 |
| ~~DeveloperAppsPage create-app modal~~ | 9+ 欄位 (app_name + redirect_uris textarea + client_type radio cards + 5 scope checkboxes) | → `src/pages/DeveloperAppNewPage.tsx` @ `/developer/apps/new` (PR #432, v2.19.8)。Secret reveal 仍以 modal-style 呈現（critical attention UX 例外）。 | ✅ 已遷 |
| ~~ExplorePage trip-picker modal~~ | 表面 modal-style backdrop，但實際是 chooser flow（selection → 立即 navigate）→ popover 而非全頁 | → `src/components/explore/TripPickerPopover.tsx` (anchored popover, PR #433, v2.19.9) | ✅ 已遷 |
| `ConfirmModal.tsx` | 確認單一 action — 符合 modal 規則 | — | ✅ 保留 |
| `InputModal.tsx` | 單行 input — 符合 modal 規則 | — | ✅ 保留 |
| `ConflictModal.tsx` | sync 衝突 1 個決策 — 符合 modal 規則 | — | ✅ 保留 |
| `TripCardMenu.tsx` | kebab popover menu — 符合 popover 規則 | — | ✅ 保留 |
| `StopLightbox.tsx` | 圖片燈箱 — 視同 popover overlay | — | ✅ 保留 |
| Developer apps secret reveal modal | 一次性 client-side state（server response 僅返回一次），跳頁 (back/share/refresh) 會丟資料 — confirm-style critical UX 例外 | — | ✅ 保留 |

**Audit 結束（2026-05-03）：6 個違規 modal 全數遷移完成。**

**P3 confirm-modal cleanup 已完成（2026-05-03, PR #435, v2.19.10）：**
| 原狀 | 改用 | 改動 |
|---|---|---|
| AccountPage `tp-logout-modal` 手刻 backdrop + alertdialog | `<ConfirmModal>` | 取代 ~40 LOC CSS + ~20 LOC JSX，testid 改為標準 `confirm-modal-confirm` |
| ConnectedAppsPage `tp-modal-backdrop` revoke confirm | `<ConfirmModal>` | 取代 ~40 LOC CSS + ~38 LOC JSX，testid 改為標準 `confirm-modal-confirm/-cancel` |
| Developer apps secret reveal | （保留） | critical attention UX 例外，不在 cleanup 範圍 |

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
- ExplorePage 收藏批次「刪除」 → ConfirmModal
- ExplorePage region pill「+ 自訂地區…」 → InputModal
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
- **Touch target:** 最小 44×44px（Apple HIG）
  - **Exception**：`.ocean-rail-grip`（拖拉排序 handle）使用 24×24px 對齊 mockup S12 Variant A `tp-stop-v-grip` spec。理由：grip 與 row 主點擊區並存於同一 grid 列，44×44 會與 `.ocean-rail-head`（行展開按鈕，已 ≥44px）視覺衝突搶 click target。鍵盤 a11y 由 `:focus-visible` ring + opacity 1 保證可見性。詳見 Decisions Log 2026-05-02。
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（muted text `#6F5A47` / dark `#B5A08A` 需持續驗證）
- **Focus:** 所有互動元素有 focus-visible ring
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks + `role="tab"` 在 day chips

## Design Principles（開發時參考）
1. **DESIGN.md + design-sessions 是單一來源** — `tokens.css` 是實作；若文件和程式衝突，先更新文件再實作。
2. **Terracotta 單一 accent** — 只有 sight/food、active state、CTA 用 terracotta。其他一律 ink，避免七彩稀釋重點。
3. **Chrome 一致優先** — 聊天、行程、地圖、探索、帳號的 sidebar / bottom nav / titlebar 行為要一致；地圖只例外在內容 full bleed。
4. **內容寬度一致** — 一般頁面統一 `1040px` content max width；局部表單可在內部限寬，但外層節奏一致。
5. **行程明細單一來源** — Desktop / compact 共用同一份內容樹與狀態來源，只讓 layout responsive。
6. **Bottom nav 是主功能定位** — 子頁 active item 依所屬主功能，不把 bottom nav 當 breadcrumb。
7. **錯誤必須可見且可行動** — Toast 只處理離線/恢復連線/低風險狀態；真正錯誤使用 persistent surface。
8. **Hairline over shadow** — 卡片區分優先用 1px border，shadow 只用在浮層（toast、sheet、dialog）。
9. **Tabular numbers everywhere** — 時間、日期、stats 數字強制 `tabular-nums`。
10. **無裝飾元素** — 不用 gradient、emoji、decorative SVG、rainbow 類型色；資訊本身是主角。

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-03 | **TitleBar 第二層頁面規則** | 第二層以下頁面（trip 子頁、settings 子頁、新建立的 form pages）一律「左 36×36 返回 + 中標題 + 右 action」三段式。Action button responsive：桌機 `icon + 文字`、手機 `icon only`（aria-label 補語意）。實作走 CSS `.tp-titlebar-action-label` 在 compact 改 `display: none`，或 useMediaQuery。詳見 Components > Page Titlebar section。 |
| 2026-05-03 | **Modal vs Full Page 明文規則 + 3 modal 遷移計畫** | Modal 限定 confirm / input / popover；多欄位 form / sortable list / inline search 必走全頁 + TitleBar shell。判斷準則：「user 可能想用 browser back 取消」「想 deep-link 給隊友看畫面」→ 走全頁。3 個違規 component（NewTripModal / EditTripModal / AddStopModal）排程遷至 `/trips/new` / `/trip/:id/edit` / `/trip/:id/add-stop` page。詳見 Modal Dialogs > Modal vs Full Page Decision + Audit table。 |
| 2026-05-03 | **Modal-to-fullpage migration 完成（6 PR series）** | Audit 原列 3 個違規，實際走完發現另 3 個漏列：(1) `EntryActionPopover` 表面 popover 實則含 day picker + time select + confirm CTA → 重新分類為違規（PR #430, v2.19.6）；(2) DeveloperAppsPage create-app modal 9+ field form（PR #432, v2.19.8）；(3) ExplorePage trip-picker chooser → anchored popover（PR #433, v2.19.9 — chooser 例外不走全頁）。完整 6 PR 序列：#428 EditTrip → #429 NewTrip → #430 EntryAction → #431 AddStop → #432 DeveloperAppNew → #433 ExploreTripPicker。Audit table 全數標記 ✅。剩 P3 confirm-modal cleanup（AccountPage logout / ConnectedAppsPage revoke / DeveloperAppsPage secret-display）。 |
| 2026-05-03 | **TitleBar action button consistency fix + spec unification (PR #441 + mockup integration)** | User 觀察行程一覽 vs 行程明細 TitleBar 視覺不一致 — 一覽用 `.tp-titlebar-action` (pill + responsive label)，明細用自製 `.tp-embedded-menu-trigger` (square 36×36)。同期觀察手機版 button 「無框」(因 `border: none` @media)。本批 fix:(1) PR #441 把明細頁「加景點」 button class 從 `.tp-embedded-menu-trigger` 改為 `.tp-titlebar-action`，跟一覽頁一致；(2) `css/tokens.css` mobile `.tp-titlebar-action` 加回 1px border（對齊桌機 + `.is-primary` family）；(3) mockup `terracotta-preview-v2.html` 加 Section 23 TitleBar Action Button Spec live demo（4 button visual sample + 用法 audit）；(4) mockup 整合原 `trip-modal-v2-osm-fields.html` 1358 行進主 mockup 變成 Section 24（osm-fields 原檔已刪 — SoT 統一）；(5) DESIGN.md「Page Titlebar」 section 補完整 spec table + 例外 class 說明 + height 一致性宣告。TitleBar 自身 height (桌機 64px / 手機 56px) 全 page 同規則無 override，user 感知「明細較高」 是內部 button 樣式差異視覺 + 後續 Day hero 28px 緊接無 spacing buffer 造成。 |
| 2026-05-03 | **P3 confirm-modal cleanup 完成（PR #435, v2.19.10）** | AccountPage 登出二次確認 + ConnectedAppsPage 撤銷第三方 app 兩個手刻 modal（各自 ~40 LOC CSS + ~20-38 LOC JSX）改用標準化 `<ConfirmModal>` 元件，對齊 mockup S22 Dialogs system 統一視覺 + a11y (alertdialog / portal / ESC / focus trap / V2 Terracotta destructive 紅色 confirm button)。Developer apps secret reveal 不在 cleanup 範圍 — 屬 critical attention UX 例外（一次性 server response state，跳頁會丟資料）。Unit test testid 從 page-specific 改為 ConfirmModal 標準 `confirm-modal-confirm/-cancel`，淨減 ~110 LOC code。 |
| 2026-05-02 | **TimelineRail row 對齊 mockup S12 Variant A 5 欄 grid** | 從巢狀 `(44 24 1fr) + (48 1fr auto)` 改單層 `24 60 44 1fr 24`（grip / time+dur / icon / content / caret）；移除冗餘 `.ocean-rail-dot` 編號圓圈（mockup 沒此元素，與 grip 視覺競爭）；time 加 dur 副行（`30 分鐘` / `4 HR`）；grip 改永遠淡顯 0.4，hover 變 accent。詳見 v2.18.3。 |
| 2026-05-02 | **Grip handle 24×24 例外（vs Apple HIG 44×44）** | `.ocean-rail-grip` 為 row level 拖拉手柄，對齊 mockup `tp-stop-v-grip` 24px spec。row 主點擊區 `.ocean-rail-head` 已是 ≥44px button；若 grip 也 44×44 兩者會搶 click target 互相覆蓋。鍵盤 a11y 由 `:focus-visible` ring + opacity 1 補償；觸控用戶仍可命中 24×24（透過 hover state visible），mobile drag UX 為 hold-and-drag pattern 不依賴 tap precision。 |
| 2026-05-02 | **餐廳推薦 section（meal entry expand 內）** | meal entries 在 expand panel 介於「地點」與「備註」之間插入「餐廳推薦」section。資料層 `entry.infoBoxes[type='restaurants']` 早已 ship（PR #163），按 `sort_order` 升冪：≥2 家走 hero variant（accent 邊框 + 漸層底）+「備選」divider + 後續 standard cards；1 家走 standard 不分。Hero 識別純靠視覺（不掛 chip 避免冗餘）；備選 ≥3 家全展開不收合（user 拍板）。Mockup spec：`terracotta-preview-v2.html` Section 12 Variant A。 |
| 2026-05-02 | **EntryActionPopover layout responsive** | popover 寬度 `min(320px, calc(100vw - 32px))` 避免 mobile 溢出；桌機 anchor 從 `right: 0` 改 `left: 0` 避免左半被 DesktopSidebar (fixed 152px) 蓋住；Day label 改兩行 stack —主行「Day N + count」副行短日期 `7/29（三）` + 「目前」chip。`shortenDateLabel` regex `\d{2}` 對齊 caller `parseLocalDate` zero-padded contract。 |
| 2026-05-02 | **MapPage 預設「總覽」tab** | 無 `?day=` 參數 + 無 entry deeplink → `initialTab='overview'`（原預設 Day 1）。先看整趟全貌再縮特定日，符合 user 拍板「地圖預設全覽」原則。Entry deeplink + `?day=N` URL 行為不變。 |
| 2026-04-27 | **Terracotta pages refactor implementation complete** | `terracotta-pages-refactor` aligned the main page chrome to `TitleBar title/back/actions`, kept `PageHeader` only for settings/splash pages, removed hotel emoji markers from map surfaces, switched `/trip/:id/map` back to direct `MapPage` for day-tab URLs, and made `NewTripModal` form-first single-column with multi-destination chips |
| 2026-04-27 | **Trip detail shared implementation + owner-aware bottom nav** | 行程明細頁 desktop / compact 共用同一份內容與狀態來源；compact bottom nav active state 依子頁所屬主功能定位，使用淡底 pill + top indicator，避免與 CTA 混淆 |
| 2026-04-27 | **Persistent error messaging system** | Toast 僅保留給離線、恢復連線與低風險狀態；表單、儲存、登入、頁面與地圖錯誤改用明顯 persistent surfaces，避免使用者漏看重要問題 |
| 2026-04-27 | **Desktop / compact typography split** | 桌機與 compact 共用 Inter + Noto Sans TC，但各自使用 role-based type scale；titlebar 與 content title 分離，中文 body 固定 16px / 26px，中文 letter-spacing 維持 0 |
| 2026-04-27 | **Unified app chrome + Terracotta source of truth** | 聊天、行程、地圖、探索、帳號統一 titlebar / sidebar / bottom nav；desktop = `min-width: 1024px` 且 `pointer: fine`，其餘走 compact；一般內容寬度統一 1040px，地圖 full bleed 例外；新增行程 modal 移除大型形象圖 |
| 2026-03-22 | ~~System font stack~~ → 2026-04-19 改 Inter + Noto Sans TC | 設計稿指定 Inter，CJK 用 Noto Sans TC；Web font 載入已有 preconnect + swap |
| 2026-03-22 | Apple HIG type scale | 保留，字級依然合理 |
| 2026-03-24 | ~~Caveat for Logo~~ → 2026-04-19 棄用 | 設計稿的三線 lego mark 取代手寫字（2026-04-23 lego mark 亦棄用，全站移除品牌標誌） |
| 2026-03-25 | ~~6 color themes~~ → 2026-04-19 Ocean-only → 2026-04-27 Terracotta-only | 設計稿要求單一主題；簡化 theme picker UI 降低認知負擔 |
| 2026-03-26 | Tailwind CSS 4 + tokens.css | 保留 |
| 2026-03-29 | DESIGN.md created | 保留 |
| 2026-04-19 | **Ocean single-theme redesign（已由 2026-04-27 Terracotta 取代）** | Claude Design 的 Okinawa Trip Redesign/Mobile 作為當時方向；後續因整體暖色 editorial 方向改為 Terracotta |
| 2026-04-19 | Legacy topbar: nav tabs + 緊急/列印/AI 編輯（已由 2026-04-27 Page Titlebar 取代） | 當時設計稿定義的 IA；現行主功能頁改採統一 sticky titlebar |
| 2026-04-19 | Stop card: 4-col grid | 取代原 polygon time flag；match 設計稿 `.rtl-stop` 排版 |
| 2026-04-19 | Hairline borders | 取代 shadow 作為卡片區分，符合 Airbnb 規範 |
| 2026-04-19 | Stop type accent rule: only sight/food | 「一個 accent」原則 — 避免七彩類型稀釋重點 |
| 2026-04-21 | Glass unified 14px + DV color exception | 三層 glass（titlebar/bottom-nav/sheet）統一 blur(14px)；sheet 去 saturate；DV 可用 10 色 qualitative palette |
| 2026-04-23 | 移除 `TriplineLogo`（lego mark + Trip/Line wordmark） | 全站 header 不再顯示品牌標誌；刪除元件、CSS、對應測試，各頁不再有 home-link 入口 |
| 2026-04-25 | **Layout Refactor v2.3.0 — Mindtrip-inspired 3-pane shell** | SaaS pivot 第一階段。Desktop 3-pane (sidebar 240 + main + sheet 40vw)，mobile single-col + bottom nav 4-tab。新 `AppShell` / `DesktopSidebar` / `BottomNavBar` / `TripSheet` primitives。詳見 `docs/2026-04-25-session-retro.md` |
| 2026-04-25 | URL-driven sheet state | `?sheet=itinerary\|ideas\|map\|chat` deep-linkable + browser nav 正常；~~`/trip/:id/map` 301 redirect~~ 已於 2026-04-27 改為 direct `MapPage` route，讓 `?day=all\|N` day tabs 可直接 deep-link |
| 2026-04-25 | ARIA tabs pattern + keyboard nav | TripSheetTabs 完整 W3C tabs pattern：id / aria-controls / role=tabpanel / aria-labelledby；ArrowLeft/Right/Home/End 鍵盤切 tab + roving tabindex |
| 2026-04-25 | Color contrast WCAG 2.x AA verified | unit test 13 cases 驗 light + dark theme 主 color pairs ≥ 4.5:1（body）/ 3.0:1（large/UI）|
| 2026-04-25 | `prefers-reduced-motion` global override | universal selector 把 animation/transition-duration 縮 0.01ms（保留 transitionend event 行為）|
