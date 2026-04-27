# Design System — Tripline（Terracotta）

> **Legacy naming note**：CSS class 前綴 `.ocean-*`（`.ocean-topbar` / `.ocean-hero` / `.ocean-stop` 等）為歷史命名保留，不隨主色變更而 rename — 避免全站 class refactor 風險。設計語言層（accent、mood、差異化）已從 Ocean Blue 轉為 Terracotta 暖橘（2026-04-24）。

## Product Context
- **What this is:** 行程共享網站 — 旅伴可以瀏覽精美行程表（時間軸、餐廳推薦、飯店、地圖導航）
- **Who it's for:** 旅伴（家人朋友），非技術人員,旅行中在手機上使用
- **Space/industry:** 旅行行程規劃，偏向個人/小團體（非商業旅遊平台）
- **Project type:** Mobile-first PWA（React SPA + Cloudflare Pages）

## Aesthetic Direction
- **Direction:** Warm editorial — 明信片／雜誌式版面，有機溫暖（warm organic），clean Airbnb-inspired
- **Decoration level:** Restrained — 靠排版、留白、hairline、單一 accent 支撐畫面，不靠裝飾 SVG
- **Mood:** 溫暖、期待感、夕照沙漠色調。米白底 + Terracotta 暖橘 accent 讓行程資訊保持主角，整體氛圍像翻開一本旅行雜誌
- **Differentiation:** 單一色調 Terracotta（非藍色系、非六主題切換）、米白底取代純白（warm paper feel）、Airbnb 式三層陰影、Inter + Noto Sans TC 排版
- **Reference sites:** Airbnb（card + shadow）、Apple HIG（tap target、subheadline）、Kinfolk/Cereal Magazine（暖色 editorial palette）、Anthropic Claude Design 稿（Okinawa Trip Redesign/Mobile）

## Typography

### Font Stack
- **Primary:** `Inter` — Web font，400/500/600/700/800 weight
- **CJK Secondary:** `Noto Sans TC` — 中文字體優先於系統字
- **Fallback:** `-apple-system, BlinkMacSystemFont, "PingFang TC", system-ui, sans-serif`
- **Rationale:** Inter 是 Airbnb 風設計稿的指定字體；Noto Sans TC 覆蓋 CJK 字符；系統字做最後 fallback
- **Loading:** `<link>` 預連線 + `display=swap`（不阻擋首屏）

### Type Scale（Apple HIG 保留）
| Token | Size | 用途 |
|-------|------|------|
| large-title | 2.125rem (34px) | 行程大標（`.ocean-h1`） |
| title | 1.75rem (28px) | Day hero 標題 |
| title2 | 1.375rem (22px) | Section 標題 |
| title3 | 1.25rem (20px) | 卡片標題 |
| headline | 1.0625rem (17px) | Stop name、強調 |
| body | 1.0625rem (17px) | 內文 |
| callout | 1rem (16px) | 次要內文 |
| subheadline | 0.9375rem (15px) | 輔助文字 |
| footnote | 0.8125rem (13px) | 註腳、按鈕文字 |
| caption | 0.75rem (12px) | 最小文字 |
| caption2 | 0.6875rem (11px) | 最小行內 meta label（例：NIGHT 1 等） |
| eyebrow | 0.625rem (10px) | 大寫 section header（例：DAY 01、STOPS、用餐） |

## Type Scale (Mobile ≤760px)

Mobile 閱讀環境字級做適當縮放，body 從 17px 降至 16px 改善行動閱讀體驗。

| Token | Desktop | Mobile | 用途 |
|-------|---------|--------|------|
| large-title | 34px | 28px | 行程大標 |
| title | 28px | 24px | Day hero 標題 |
| title2 | 22px | 20px | Section 標題 |
| title3 | 20px | 18px | 卡片標題 |
| headline | 17px | 17px | Stop name、強調 |
| body | 17px | 16px | 內文 |
| callout | 16px | 15px | 次要內文 |
| subheadline | 15px | 14px | 輔助 |
| footnote | 13px | 13px | 註腳、按鈕 |
| caption | 12px | 12px | 最小 |
| caption2 | 11px | 11px | uppercase eyebrow 行標 |
| eyebrow | 10px | 10px | DAY 01 等 uppercase label |

### Weight Scale
| Token | Value | 用途 |
|-------|-------|------|
| normal | 400 | body 內文 |
| medium | 500 | UI 元素 |
| semibold | 600 | 按鈕、強調、stop type eyebrow |
| bold | 700 | 標題、日期數字、hero title |
| heavy | 800 | 極強調（少用） |

### Specialised Patterns
- **Eyebrow / uppercase labels**：`font-size: 10px; font-weight: 600; letter-spacing: 0.18-0.2em; text-transform: uppercase;`
- **Tabular numbers**：時間（16:30）、日期（7/2）一律 `font-variant-numeric: tabular-nums`

## Color

### Approach
**單一 Terracotta 主題** — 不再提供六主題切換。Terracotta `#D97848` 是唯一 accent，其他一切都是暖米白底 + 溫暖中性色階。色彩是功能性訊號（用餐/景點 accent、其他 ink）。

**色系哲學**：warm-toned neutrals — 所有中性色（background/surface/border/text）都帶微量暖色 undertone（warm gray / taupe），不用純冷色 #FFF/#EEE/#222。整體視覺像一張舊明信片或旅行雜誌頁面，不是冷白色螢幕。

### Light Mode (Terracotta — Default)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#D97848` | 主要強調色（CTA、active tab、day chip active、hero bg、sight/food icon） |
| accent-subtle | `#FBEEE4` | 強調色淡化（accent button hover、chip bg） |
| accent-bg | `#F7DFCB` | 強調色背景（badge） |
| accent-deep | `#B85C2E` | 按下狀態、深化 accent（hover pressed） |
| background | `#FFFBF5` | 頁面底色（暖米白，warm paper） |
| secondary | `#FAF4EA` | 奶油色 section bg |
| tertiary | `#F2EAD9` | 暖米色 surface（input、recessed area） |
| hover | `#F9EDE0` | 互動回饋 |
| foreground | `#2A1F18` | 主要文字（深棕，非冷黑） |
| muted | `#6F5A47` | 次要文字（warm taupe，WCAG AA 4.5:1 on #FFFBF5） |
| border | `#EADFCF` | 細分隔線（暖米） |

### Dark Mode (Terracotta Dark — Warm Nocturne)
核心策略：**避免純黑冷調**。底色用 warm charcoal（#1C140F，帶微量紅棕 undertone），accent 提亮為 sunset 橘（#F0935E），整體像在燈光昏暗的旅店房間翻閱行程 — 溫暖而非冷冽。

| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#F0935E` | 提亮 terracotta（深底可見 + 不刺眼） |
| accent-subtle | `#3A2418` | 深橘淡化 bg（accent button hover dark） |
| accent-bg | `#4A2D1C` | 深橘背景（badge dark） |
| accent-deep | `#D97848` | 按下狀態、深化 accent dark |
| background | `#1C140F` | 深焦糖底（warm charcoal） |
| secondary | `#26201A` | 抬高表面 |
| tertiary | `#332A22` | 下沉表面 |
| hover | `#2E251E` | 互動回饋 |
| foreground | `#F5EBDC` | 主要文字（奶油色） |
| muted | `#B5A08A` | 次要文字（warm taupe light） |
| border | `#3A3127` | 細分隔線 |

### Semantic Colors
暖橘 accent 下，semantic 色需要跟 accent 明顯區隔。**warning 從原本 `#F48C06` 改為 `#C88500`**（因跟 accent `#D97848` 色相過近會混淆）；**info 不再是 accent blue 別名**，改為 dusty blue `#3B7EA1`（與 terracotta 形成互補色，明顯區分非主色資訊）。

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| destructive | `#C13515` | `#E8A0A0` | 刪除、錯誤 |
| success | `#06A77D` | `#7EC89A` | 成功、確認（冷綠保留作為「完成」訊號，跟暖橘 accent 形成 warm/cool 對比） |
| warning | `#C88500` | `#E8B556` | 警告（黃褐，跟 accent terracotta 區隔） |
| info | `#3B7EA1` | `#8FB8D1` | 資訊提示（dusty blue，跟 accent 互補） |

### Stop Type Color Convention
設計稿「一個 accent」原則：**只有 sight（景點）、food（用餐）**用 Terracotta accent，其餘類型（flight/hotel/walk/drive/shop/rest）一律 ink（`#2A1F18`）。這讓 accent 仍保有「重點」的訊號意義，不會過度使用而失焦。

### Data Visualization 例外（Color section 下）

「單一 Terracotta accent」原則有 **data visualization 例外**：地圖 polyline、chart series、時間軸 day separator 等 semantic encoding 可用 10 色 qualitative palette。UI chrome（button、text、icon、active state）仍嚴守單 Terracotta。

**OSM 底圖可見度約束（2026-04-24）**：trip-planner 地圖以 OpenStreetMap Carto/Mapnik tiles 為底，其標準色域多為 pastel：
- motorway `#e892a2` 淺粉 / trunk `#f9b29c` 蜜桃 / primary `#fcd6a4` 橘黃 / secondary `#f7fabf` 奶黃
- water `#aad3df` 淺藍 / forest `#c8facc` 淺綠 / park `#b5e3a4` 草綠
- land `#f2efe9` 暖米 / building `#d9d0c9` 淺棕 / railway `#4a4a4a` 深灰

為避免 polyline 在 OSM tiles 上「融掉」看不清，DV palette 色相鎖在 **85°-345° 高飽和區間**（避開 0-80° 的暖橘色區，保留給 Terracotta accent），亮度 Tailwind -600/-700 級別（比原 -500 更深），polyline 2-3px stroke 對比鮮明。

**新 10 色 Day palette（OSM-safe + 相鄰交錯）**：

**排序原則**：色相 85°–345° 高飽和區間內，**interleave 紅紫群（4 色）與冷群（藍+青綠共 6 色）**，避免連續兩天色相相近。最小相鄰 Δhue = **70°**（D2 sky 200° → D3 violet 270°）。

| # | Day | Tailwind | Hex | 色相角 | Δ vs 上一日 | 功能 |
|---|-----|----------|-----|--------|-------------|------|
| 1 | Day 1 | rose-700 | `#BE123C` | ~345° | — | 深玫瑰紅，跟 accent terracotta 有 35° 色相差 |
| 2 | Day 2 | sky-700 | `#0369A1` | ~200° | **145°** | 深青，跳到冷群，vs water pastel 飽和強 |
| 3 | Day 3 | violet-600 | `#7C3AED` | ~270° | 70° | 紫（min Δ pair） |
| 4 | Day 4 | emerald-600 | `#059669` | ~155° | **115°** | 深翡翠，跳到綠群 |
| 5 | Day 5 | fuchsia-600 | `#C026D3` | ~300° | **145°** | 洋紅 |
| 6 | Day 6 | blue-700 | `#1D4ED8` | ~220° | 80° | 皇家藍 |
| 7 | Day 7 | pink-600 | `#DB2777` | ~330° | 110° | 玫粉 |
| 8 | Day 8 | teal-600 | `#0D9488` | ~175° | **155°** | 深青綠 |
| 9 | Day 9 | lime-600 | `#65A30D` | ~85° | 90° | 深黃綠，vs park pastel 飽和差 |
| 10 | Day 10 | indigo-700 | `#4338CA` | ~245° | **160°** | 深靛 |

**刻意排除的色**：
- **Amber / yellow / orange 全系** — 與 OSM road/trunk/secondary 衝突，同時跟 terracotta accent 色相重疊
- **Tailwind -300 / -400 pastel level** — 飽和度不足，在 OSM pastel tiles 上融掉
- **Slate-700+ / gray-800+** — 跟 OSM railway `#4a4a4a` 深灰近，辨識困難

**Adjacent-day 交錯保證**：Day N 與 Day N+1 polyline 疊在地圖上永遠不會「看起來同色」— 每對相鄰色必然跨越色相群（紅紫 ↔ 冷）或跨 ≥70° 色相。Min Δ pair 為 D2 sky → D3 violet（70°），兩者 chroma 相差 31（LCh 空間 ΔE ~35+，遠超 JND threshold）。

**地圖 chrome 子例外（2026-04）：** 在地圖相關頁面（`MapPage`、`TripMapRail`、`OceanMap`）的 **Day 指示 tab active state**（底線色、eyebrow `DAY NN` 文字色），可套用 `dayColor(N)` 作為 visual cueing，與 polyline 同色呼應。理由：使用者需要能快速辨認「當前看的是哪一天」，chrome 色和 polyline 色對齊提供一致的心智模型。適用範圍**僅限 Day 指示 tab**；其他 chrome（返回鈕、主導航、title、overflow menu）仍嚴守 Terracotta。

**地圖 chrome 子例外（2026-04）：** 在地圖相關頁面（`MapPage`、`TripMapRail`、`OceanMap`）的 **Day 指示 tab active state**（底線色、eyebrow `DAY NN` 文字色），可套用 `dayColor(N)` 作為 visual cueing，與 polyline 同色呼應。理由：使用者需要能快速辨認「當前看的是哪一天」，chrome 色和 polyline 色對齊提供一致的心智模型。適用範圍**僅限 Day 指示 tab**；其他 chrome（返回鈕、主導航、title、overflow menu）仍嚴守 Terracotta。

## Spacing

### Base Unit
4px grid — 所有間距為 4 的倍數。

### Scale
| Token | Value | 用途 |
|-------|-------|------|
| half | 2px | 微調 |
| 1 | 4px | 最小間距 |
| 2 | 8px | 元素內 padding、topbar gap |
| 3 | 12px | 小間隔、topbar vertical padding |
| 4 | 16px | 標準 padding（= padding-h） |
| 5 | 20px | hero 內 padding（mobile） |
| 6 | 24px | section gap、body grid gap |
| 8 | 32px | hero horizontal padding（desktop） |
| 10 | 40px | topbar horizontal padding |
| 12 | 48px | nav 高度 |
| 16 | 64px | 極大間隔 |

### Key Layout Measurements
| Token | Value | 用途 |
|-------|-------|------|
| padding-h | 16px | 頁面水平 padding |
| tap-min | 44px | 最小觸控目標（Apple HIG） |
| page-max-w | 1440px | 桌面頁面最大寬 |
| content-max-w | 720px | 文字內容最大寬度 |
| info-panel-w | 320px | 桌面版側邊 SideCard 欄寬 |
| nav-h | 48px | Ocean topbar 高度 |
| day-chip-w | 160px | Day chip 寬度（desktop）、140/130 遞減 |
| stop-time-col | 68px | stop card 時間欄寬 |
| stop-icon-box | 48px | stop card icon 方塊（desktop） |
| fab-size | 56px | QuickPanel FAB |

## Layout

- **Approach:** Mobile-first responsive，但結構 mirror 設計稿（topbar + header + day strip + body grid）
- **Grid:** 2-col（main + 320px sticky sidebar） → 1-col stack at 960px
- **Topbar:** sticky glass blur（`rgba(255,255,255,0.92) + backdrop-filter: blur(14px)`）
- **Day strip:** `flex` + `overflow-x: auto` + scroll snap

### Responsive Breakpoints
| Width | 變化 |
|-------|------|
| ≤1200px | sidebar 寬縮至 300px、page padding 24/28 |
| ≤1100px | topbar 水平 scroll、brand label 隱藏 |
| ≤960px | sidebar 堆疊到 main 下方、h1 縮到 28px、hero title 28px |
| ≤760px | nav tab label 隱藏（只剩 icon）、stop card 3-col、hero 22px |
| ≤480px | day chip 縮 130px |

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

- **Glass:** Topbar、bottom-nav、sheet 統一使用 `backdrop-filter: blur(14px)`（`--blur-glass: 14px`）。三層 glass 元素保持一致強度，避免不同 blur 強度造成視覺雜亂。Sheet 拿掉 `saturate(1.8)` — 對齊 editorial clean direction，去除色飽和增強。不再給 timeline card 用（設計稿強調乾淨、無模糊）。
- **Shadow scale（Airbnb 三層）：**
  | Token | Value | 用途 |
  |-------|-------|------|
  | sm | `0 1px 2px rgba(0,0,0,0.04)` | 微妙抬升（input、chip） |
  | md | `0 6px 16px rgba(0,0,0,0.08)` | 卡片 |
  | lg | `0 10px 28px rgba(0,0,0,0.12)` | 浮層、toast、sheet |
- **Focus ring:** `0 0 0 2px accent` — 鍵盤導航可見性
- **Hairline borders:** `1px solid #EBEBEB`（light）/`1px solid #2E3B4F`（dark）取代重邊線。卡片區分用 border 而非 shadow。

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

### Topbar（`.ocean-topbar`）
- Sticky + glass，border-bottom 1px hairline
- Left: DestinationArt（目的地主題 SVG）+ `{行程名稱}` muted label
- Nav tabs: **行程** / **路線** / **航班** / **AI 建議** — active = Ocean 實心白字
- Right: 緊急（icon + label）/ 列印 / **AI 編輯**（Ocean accent fill pill，白字）
- Height: 48px + 12px vertical padding（實測 ~62px）

### Day Chip（`[data-dn]`）
- 160×auto（mobile 140/130）
- Border hairline，active = Ocean 實心白字
- 內容三段：
  1. eyebrow `DAY 01` + 右上 TODAY 標記（若適用）
  2. 大日期 `7/2` + 小 dow `Thu`
  3. area label 一行
  4. 6 個 progress marks（`14×2px` 小橫條）

### Hero Card（`.ocean-hero`）
- Terracotta primary bg（`#D97848`），白字（#FFFBF5）
- chips row：`DAY 01 · 2026-07-02（四）` + area muted
- title 32px bold
- stats row: Stops / Start / End，三欄 left-border 分隔

### Stop Card（`.ocean-stop`）
- 4-col grid：`68px time | 48px icon box | content | actions`
- 米白 bg（`#FFFBF5`）+ hairline border（`#EADFCF`）+ 8px radius + hover → border-Terracotta
- Icon box 米白底 + hairline，sight/food 用 Terracotta accent border + icon color
- Stop name 17px bold，type eyebrow 10px uppercase
- `data-now="true"` → Terracotta border + shadow-md
- `data-past="true"` → opacity 0.65

### Side Card（`.ocean-side-card`）
- White bg + hairline + 12px radius
- Header：uppercase title（11px bold letter-spacing 0.18em）+ 右上 icon + hairline divider
- 用於 sheet 內小型資訊 card（例：FlightSheet 航班列表、SuggestionSheet 建議卡）

### Travel Connector（`.ocean-travel`）
- Stop 之間的交通段，左側 2px dashed Terracotta border + icon + text
- 縮排 34px（對齊 stop 內 icon box 左緣）

## Overlay Pattern Rules

Overlay = 任何遮蓋主內容的 UI layer（modal / bottom sheet / full-screen cover）。用錯 pattern 會破壞使用者心智模型。以下 rules 為所有新 overlay 的 canonical 依據（來源：`docs/design-sessions/lean-master-design-20260424-190000-mindtrip-layout-reference.md` Appendix，office-hours Q6 locked）。

### 決策樹

**1. 使用者要做 primary action（完整注意力 + 表單輸入）？**
- 桌機 → **Centered Modal**（max-width 1000px, rounded 12-16px, backdrop dim 60%）
- 手機 → **Full-screen Cover**（100vw × 100vh, close X top-left）
- 例子：建立 trip / 登入 / 選日期 / 編輯 entry 時間

**2. 使用者要快速看內容但不做 primary action（peek）？**
- 桌機 → **Popover**（小 floating panel，anchored to trigger）
- 手機 → **Bottom Sheet**（drag-able, ~60-80vh max）
- 例子：POI detail peek / 快速 filter preview / 分享選單

**3. 使用者要 destructive confirm（刪除 / 不可逆動作）？**
- 桌機 → **Small Centered Modal**（max-width 480px）
- 手機 → **Small Centered Modal** or Bottom Sheet
- 例子：確認刪除 trip / 登出 / 清除草稿

**4. 多步流程 wizard？**
- 桌機 → Centered Modal with progress indicator（步驟點 x/y）
- 手機 → Full-screen Cover with back button（header 顯示「Step 2 of 3」）
- 例子：Onboarding 三步 / 新 trip 三步（Destination → Timing → Preferences）

### Pattern 對照表

| Scenario | Desktop | Mobile | Max Width | Close Method |
|----------|---------|--------|-----------|--------------|
| Primary form | Centered modal | Full-screen cover | 1000px | X top-left + ESC + backdrop tap |
| Peek content | Popover | Bottom sheet | 600px / 80vh | ESC / swipe down / tap outside |
| Confirm destructive | Small modal | Small centered modal | 480px | X + Cancel button |
| Multi-step wizard | Centered modal | Full-screen cover | 1000px | X + back step button |
| Filter / share | Small modal | Bottom sheet | 400px / 60vh | Apply button or tap outside |

### Anti-patterns（明文禁止）

- ❌ **桌機用 Bottom Sheet** — bottom sheet 是 mobile-only pattern；桌機改用 popover 或 modal
- ❌ **同一個流程混 Modal 和 Bottom Sheet** — 始末 consistent，避免使用者 mental model 斷裂
- ❌ **無 close method 的 overlay** — 永遠要至少一種（X button / ESC / backdrop tap / swipe down）
- ❌ **Modal 裡面再開 Modal**（stacked）— 重新設計原 flow，通常表示 scope 太大
- ❌ **Full-screen cover 在桌機用** — 桌機至少讓 sidebar 可見，除非是 immersive content（地圖全螢幕）

### 跨 Phase 一致性對照

- **3-pane 桌機 layout**（Q1）：modal 開啟時 sidebar 不應被遮，modal centered 在 main + sheet 區域
- **Bottom nav 手機常駐**（Q3）：full-screen cover 開啟時 bottom nav 被 overlay 遮（自然）；bottom sheet 開啟時 nav 上方被 sheet 部分遮蓋 OK
- **Query param URL state**（Q4）：primary form modal 可用 URL driver 如 `?modal=create-trip`；peek overlay 不進 URL（短暫）

## Icons
- **Approach:** Inline SVG 元件系統（`src/components/shared/Icon.tsx`）
- **Size:** 跟隨 font-size（`width: 1em; height: 1em`）
- **Style:** Line stroke 1.5-1.75px，不用填充
- **Color:** 繼承 `currentColor`

## Accessibility
- **Touch target:** 最小 44×44px（Apple HIG）
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（`#6A6A6A` 已驗證）
- **Focus:** 所有互動元素有 focus-visible ring
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks + `role="tab"` 在 day chips

## Design Principles（開發時參考）
1. **設計稿是單一來源** — Okinawa Trip Redesign/Mobile.html + design_mobile.jsx 是最終樣貌；CSS token 是實作
2. **單一 accent** — 只有 sight/food、active state、CTA 用 Terracotta。其他一律 ink（`#2A1F18`），避免七彩稀釋重點
3. **Warm-toned neutrals** — 所有中性色（bg/surface/border/text）帶暖色 undertone，不用冷純 #FFF/#EEE/#222；整體像旅行雜誌紙本觸感
4. **Hairline over shadow** — 卡片區分優先用 1px border，shadow 只用在浮層（toast、sheet、hero card focus）
5. **Tabular numbers everywhere** — 時間、日期、stats 數字強制 `tabular-nums`
6. **Uppercase eyebrow 做階層** — 小寫資料用大寫 label（DAY 01 / STOPS / 景點 / 用餐）取代粗體
7. **無裝飾元素** — 不用 gradient、emoji、decorative SVG、rainbow 類型色；資訊本身是主角

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | ~~System font stack~~ → 2026-04-19 改 Inter + Noto Sans TC | 設計稿指定 Inter，CJK 用 Noto Sans TC；Web font 載入已有 preconnect + swap |
| 2026-03-22 | Apple HIG type scale | 保留，字級依然合理 |
| 2026-03-24 | ~~Caveat for Logo~~ → 2026-04-19 棄用 | 設計稿的三線 lego mark 取代手寫字（2026-04-23 lego mark 亦棄用，全站移除品牌標誌） |
| 2026-03-25 | ~~6 color themes~~ → 2026-04-19 改 Ocean-only | 設計稿要求單一主題；簡化 theme picker UI 降低認知負擔 |
| 2026-03-26 | Tailwind CSS 4 + tokens.css | 保留 |
| 2026-03-29 | DESIGN.md created | 保留 |
| 2026-04-19 | **Ocean single-theme redesign** | Claude Design 的 Okinawa Trip Redesign/Mobile 作為最終樣貌；砍 6 主題、統一 Inter + Ocean + Airbnb card system |
| 2026-04-19 | Topbar: nav tabs + 緊急/列印/AI 編輯 | 設計稿定義的 IA；DayNav 從 topbar 搬到 header 下方 |
| 2026-04-19 | Stop card: 4-col grid | 取代原 polygon time flag；match 設計稿 `.rtl-stop` 排版 |
| 2026-04-19 | Hairline borders | 取代 shadow 作為卡片區分，符合 Airbnb 規範 |
| 2026-04-19 | Stop type accent rule: only sight/food | 「一個 accent」原則 — 避免七彩類型稀釋重點 |
| 2026-04-21 | Glass unified 14px + DV color exception | 三層 glass（topbar/bottom-nav/sheet）統一 blur(14px)；sheet 去 saturate；DV 可用 10 色 qualitative palette |
| 2026-04-23 | 移除 `TriplineLogo`（lego mark + Trip/Line wordmark） | 全站 header 不再顯示品牌標誌；刪除元件、CSS、對應測試，各頁不再有 home-link 入口 |
| 2026-04-24 | **Terracotta 暖橘回歸**（從 Ocean Blue `#0077B6` 改為 Terracotta `#D97848`） | 使用者要求回歸暖色系，呼應原「暖色有機風」調性。中性色全面暖化（純白 → 米白、冷灰 → 暖 taupe、冷黑 → 深棕），整體氛圍像翻閱旅行雜誌。`.ocean-*` CSS class name 保留為歷史命名不 rename。warning 從 `#F48C06` 改 `#C88500`（避免跟 accent 橘色混淆），info 從 accent blue 改 `#3B7EA1`（互補 dusty blue）。dark mode 同步暖化底色（`#0D1B2A` deep navy → `#1C140F` warm charcoal），accent 提亮為 `#F0935E` sunset。 |
| 2026-04-24 | **Overlay Pattern Rules section 加入** | 為 layout refactor Phase 2-6 所有 modal / sheet / cover 建立 canonical 決策樹與對照表；內容來源為 `docs/design-sessions/lean-master-design-20260424-190000-mindtrip-layout-reference.md` Appendix（office-hours Q6 locked），為 PR reviewer 與開發者提供統一依據。 |
| 2026-04-24 | **DV palette OSM-safe + 相鄰交錯重設** | 原 Tailwind -500 10 色（sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald）在 OSM Carto tiles 上與 road/motorway/water/forest pastel 底色「融掉」，polyline 辨識度差。改為色相 85°-345° 高飽和區 -600/-700 palette，並以 **interleave 排序**讓相鄰 Day polyline 色相差永遠 ≥70°：D1 rose → D2 sky → D3 violet → D4 emerald → D5 fuchsia → D6 blue → D7 pink → D8 teal → D9 lime → D10 indigo。紅紫群（rose/pink/fuchsia/violet）與冷群（sky/blue/indigo + teal/emerald/lime）交替排列，不連續兩天同群。刻意排除 amber/yellow/orange 全系、-300/-400 pastel、slate-700+。 |
