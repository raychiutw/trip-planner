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
- **Letter spacing:** 中文一律 `letter-spacing: 0`。只有 uppercase `eyebrow` 可用 `0.12em`。
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

- **Glass:** Titlebar、bottom-nav、sheet 統一使用 `backdrop-filter: blur(14px)`（`--blur-glass: 14px`）。三層 glass 元素保持一致強度，避免不同 blur 強度造成視覺雜亂。Sheet 不加 `saturate(1.8)` — 對齊 editorial clean direction，去除色飽和增強。不再給 timeline card 用（設計稿強調乾淨、無模糊）。
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

### Page Titlebar（`PageHeader`）
- Sticky + glass + bottom hairline，所有主功能頁共用。
- Desktop：左側單行標題；右側只放明確 action。不要 eyebrow、meta、helper text。
- Compact：左側單行標題；右側統一 hamburger menu，展開後承載 secondary actions / account / settings。
- 高度：desktop 64px、compact 56px。標題需 ellipsis，不推擠 action 區。

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

### New Trip Modal
- Form-first single-column，desktop / compact 共用同一套 RWD。
- 不使用大型 split hero / 形象圖。可保留小 icon 或小型 accent chip，但不得佔用首屏高度。
- Desktop modal `max-width: 680-720px`；主要設定欄位與 summary/actions 必須能在常見桌機高度內一屏完成。
- Footer actions sticky bottom；compact 使用全寬 sheet 或接近全寬 dialog。

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
| 2026-04-25 | URL-driven sheet state | `?sheet=itinerary\|ideas\|map\|chat` deep-linkable + browser nav 正常；`/trip/:id/map` 301 redirect 保留舊連結 |
| 2026-04-25 | ARIA tabs pattern + keyboard nav | TripSheetTabs 完整 W3C tabs pattern：id / aria-controls / role=tabpanel / aria-labelledby；ArrowLeft/Right/Home/End 鍵盤切 tab + roving tabindex |
| 2026-04-25 | Color contrast WCAG 2.x AA verified | unit test 13 cases 驗 light + dark theme 主 color pairs ≥ 4.5:1（body）/ 3.0:1（large/UI）|
| 2026-04-25 | `prefers-reduced-motion` global override | universal selector 把 animation/transition-duration 縮 0.01ms（保留 transitionend event 行為）|
