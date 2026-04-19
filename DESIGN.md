# Design System — Tripline（Ocean）

## Product Context
- **What this is:** 行程共享網站 — 旅伴可以瀏覽精美行程表（時間軸、餐廳推薦、飯店、地圖導航）
- **Who it's for:** 旅伴（家人朋友），非技術人員，旅行中在手機上使用
- **Space/industry:** 旅行行程規劃，偏向個人/小團體（非商業旅遊平台）
- **Project type:** Mobile-first PWA（React SPA + Cloudflare Pages）

## Aesthetic Direction
- **Direction:** Clean editorial — 明信片／雜誌式版面，clean Airbnb-inspired
- **Decoration level:** Restrained — 靠排版、留白、hairline、單一 accent 支撐畫面，不靠裝飾 SVG
- **Mood:** 清爽、專業、旅行前的期待感。純白底 + Ocean 海洋藍 accent 讓行程資訊保持主角
- **Differentiation:** 單一色調 Ocean（非六主題切換、非暖色沙土）、Airbnb 式三層陰影、Inter + Noto Sans TC 排版
- **Reference sites:** Airbnb（card + shadow）、Apple HIG（tap target、subheadline）、Anthropic Claude Design 稿（Okinawa Trip Redesign/Mobile）

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
| caption2 | 0.6875rem (11px) | uppercase eyebrow（DAY 01 / STOPS 等） |

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
**單一 Ocean 主題** — 不再提供六主題切換。Ocean `#0077B6` 是唯一 accent，其他一切都是中性灰階 + 白底。色彩是功能性訊號（用餐/景點 accent、其他 ink）。

### Light Mode (Ocean — Default)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#0077B6` | 主要強調色（CTA、active tab、day chip active、hero bg、sight/food icon） |
| accent-subtle | `#E0F4FA` | 強調色淡化（accent button hover、chip bg） |
| accent-bg | `#CAF0F8` | 強調色背景（badge） |
| background | `#FFFFFF` | 頁面底色（純白） |
| secondary | `#F7FBFD` | 極淡冷白（section bg） |
| tertiary | `#F2F2F2` | 中性 surface（input、recessed area） |
| hover | `#F2F8FB` | 互動回饋 |
| foreground | `#222222` | 主要文字（深灰近黑） |
| muted | `#6A6A6A` | 次要文字（WCAG AA 4.5:1） |
| border | `#EBEBEB` | 細分隔線 |

### Dark Mode (Ocean Dark — Deep Navy)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#48CAE4` | 提亮的 Ocean（深底可見） |
| background | `#0D1B2A` | 深海軍底 |
| secondary | `#1B263B` | 抬高表面 |
| tertiary | `#2E3B4F` | 下沉表面 |
| foreground | `#E0F4FA` | 主要文字（冷白） |
| muted | `#90A4B8` | 次要文字 |
| border | `#2E3B4F` | 分隔線 |

### Semantic Colors
| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| destructive | `#C13515` | `#E8A0A0` | 刪除、錯誤 |
| success | `#06A77D` | `#7EC89A` | 成功、確認 |
| warning | `#F48C06` | `#F0D060` | 警告 |
| info | `#0077B6` | `#48CAE4` | 資訊提示（同 accent） |

### Stop Type Color Convention
設計稿「一個 accent」原則：**只有 sight（景點）、food（用餐）**用 Ocean accent，其餘類型（flight/hotel/walk/drive/shop/rest）一律 ink（`#222222`）。這讓 accent 仍保有「重點」的訊號意義，不會過度使用而失焦。

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

- **Glass:** Topbar 專用 — `background: color-mix(in srgb, background 92%, transparent)` + `backdrop-filter: blur(14px)`。不再給 timeline card 用（設計稿強調乾淨、無模糊）。
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
- Left: 32×32 Ocean logo 方塊（三線 lego mark）+ `Trip/Line` wordmark + `· {行程名稱}` muted + divider + nav tabs
- Nav tabs: **行程** / **路線** / **航班** / **AI 建議** — active = Ocean 實心白字
- Right: 緊急（icon + label）/ 列印 / **AI 編輯**（dark ink pill，cyan dot 裝飾）
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
- Ocean primary bg，白字
- chips row：`DAY 01 · 2026-07-02（四）` + area muted
- title 32px bold
- stats row: Stops / Start / End，三欄 left-border 分隔

### Stop Card（`.ocean-stop`）
- 4-col grid：`68px time | 48px icon box | content | actions`
- White bg + hairline border + 8px radius + hover → border-Ocean
- Icon box 白底 + hairline，sight/food 用 Ocean accent border + icon color
- Stop name 17px bold，type eyebrow 10px uppercase
- `data-now="true"` → Ocean border + shadow-md
- `data-past="true"` → opacity 0.65

### Side Card（`.ocean-side-card`）
- White bg + hairline + 12px radius
- Header：uppercase title（11px bold letter-spacing 0.18em）+ 右上 icon + hairline divider
- 用於 sidebar「今日行程 / 今日住宿 / 當日交通」

### Travel Connector（`.ocean-travel`）
- Stop 之間的交通段，左側 2px dashed Ocean border + icon + text
- 縮排 34px（對齊 stop 內 icon box 左緣）

## Icons
- **Approach:** Inline SVG 元件系統（`src/components/shared/Icon.tsx`）
- **Size:** 跟隨 font-size（`width: 1em; height: 1em`）
- **Style:** Line stroke 1.5-1.75px，不用填充
- **Color:** 繼承 `currentColor`
- **Logo mark:** Trip/Line 三線 lego（`TriplineLogo` 元件），32×32 Ocean 方塊 + 3 條遞減 opacity 的橫線 + 3 個 lego stud 圓點

## Accessibility
- **Touch target:** 最小 44×44px（Apple HIG）
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（`#6A6A6A` 已驗證）
- **Focus:** 所有互動元素有 focus-visible ring
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks + `role="tab"` 在 day chips

## Design Principles（開發時參考）
1. **設計稿是單一來源** — Okinawa Trip Redesign/Mobile.html + design_mobile.jsx 是最終樣貌；CSS token 是實作
2. **單一 accent** — 只有 sight/food、active state、CTA 用 Ocean。其他一律 ink，避免七彩稀釋重點
3. **Hairline over shadow** — 卡片區分優先用 1px border，shadow 只用在浮層（toast、sheet、hero card focus）
4. **Tabular numbers everywhere** — 時間、日期、stats 數字強制 `tabular-nums`
5. **Uppercase eyebrow 做階層** — 小寫資料用大寫 label（DAY 01 / STOPS / 景點 / 用餐）取代粗體
6. **無裝飾元素** — 不用 gradient、emoji、decorative SVG、rainbow 類型色；資訊本身是主角

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | ~~System font stack~~ → 2026-04-19 改 Inter + Noto Sans TC | 設計稿指定 Inter，CJK 用 Noto Sans TC；Web font 載入已有 preconnect + swap |
| 2026-03-22 | Apple HIG type scale | 保留，字級依然合理 |
| 2026-03-24 | ~~Caveat for Logo~~ → 2026-04-19 棄用 | 設計稿的三線 lego mark 取代手寫字 |
| 2026-03-25 | ~~6 color themes~~ → 2026-04-19 改 Ocean-only | 設計稿要求單一主題；簡化 theme picker UI 降低認知負擔 |
| 2026-03-26 | Tailwind CSS 4 + tokens.css | 保留 |
| 2026-03-29 | DESIGN.md created | 保留 |
| 2026-04-19 | **Ocean single-theme redesign** | Claude Design 的 Okinawa Trip Redesign/Mobile 作為最終樣貌；砍 6 主題、統一 Inter + Ocean + Airbnb card system |
| 2026-04-19 | Topbar: nav tabs + 緊急/列印/AI 編輯 | 設計稿定義的 IA；DayNav 從 topbar 搬到 header 下方 |
| 2026-04-19 | Stop card: 4-col grid | 取代原 polygon time flag；match 設計稿 `.rtl-stop` 排版 |
| 2026-04-19 | Hairline borders | 取代 shadow 作為卡片區分，符合 Airbnb 規範 |
| 2026-04-19 | Stop type accent rule: only sight/food | 「一個 accent」原則 — 避免七彩類型稀釋重點 |
