# Design System — Tripline

## Product Context
- **What this is:** 行程共享網站 — 旅伴可以瀏覽精美行程表（時間軸、餐廳推薦、飯店、地圖導航）
- **Who it's for:** 旅伴（家人朋友），非技術人員，旅行中在手機上使用
- **Space/industry:** 旅行行程規劃，偏向個人/小團體（非商業旅遊平台）
- **Project type:** Mobile-first PWA（React SPA + Cloudflare Pages）

## Aesthetic Direction
- **Direction:** Organic/Natural — 日式旅行手帳感
- **Decoration level:** Intentional — 手寫風 Logo（Caveat）、毛玻璃材質、微妙的卡片層次
- **Mood:** 溫暖、親切、像翻開一本精心規劃的旅行手帳。不是冰冷的 SaaS dashboard，是旅行陪伴
- **Differentiation:** 暖色沙土調色板（非業界常見的藍白冷色系）、Apple HIG 原生 app 質感（非典型 web app）
- **Reference sites:** Apple Maps、Notion（排版密度）、Airbnb（溫暖感）

## Typography

### Font Stack
- **Display/Logo:** Caveat（手寫風，500/600 weight）— 品牌識別，僅用於 Logo
- **Body/UI/All:** System font stack — 原生 app 感，零載入延遲
  ```
  -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif
  ```
- **Rationale:** 旅行中網路不穩，system font 保證即時渲染。PingFang TC 優先（iOS 使用者佔多數）

### Type Scale (Apple HIG)
| Token | Size | 用途 |
|-------|------|------|
| large-title | 2.125rem (34px) | 行程標題（Large Title pattern） |
| title | 1.75rem (28px) | Day 標題 |
| title2 | 1.375rem (22px) | Section 標題 |
| title3 | 1.25rem (20px) | 卡片標題 |
| headline | 1.0625rem (17px) | 強調文字（semibold） |
| body | 1.0625rem (17px) | 內文（regular） |
| callout | 1rem (16px) | 次要內文 |
| subheadline | 0.9375rem (15px) | 輔助文字 |
| footnote | 0.8125rem (13px) | 註腳、時間標記 |
| caption | 0.75rem (12px) | 最小文字 |
| caption2 | 0.6875rem (11px) | 極小標籤 |

### Weight Scale
| Token | Value | 用途 |
|-------|-------|------|
| light | 300 | 裝飾性大標題 |
| normal | 400 | body 內文 |
| medium | 500 | UI 元素 |
| semibold | 600 | headline、按鈕、強調 |
| bold | 700 | 極強調（少用） |

## Color

### Approach
Restrained 暖色系 — 一個強調色（赤土 coral）+ 大地色中性色。色彩是有意義的，不是裝飾。

### Light Mode (Sun — Default)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#E86A4A` | 主要強調色（CTA、品牌、選中狀態） |
| accent-subtle | `#FDE8E2` | 強調色淡化（day header、hover） |
| accent-bg | `#F9DDD4` | 強調色背景（badge、tag） |
| background | `#FBF3E8` | 頁面底色（暖奶油色） |
| secondary | `#F0DABC` | 抬高表面（卡片、panel） |
| tertiary | `#E5CBA8` | 下沉表面（input、recessed area） |
| hover | `#EACFAE` | 互動回饋 |
| foreground | `#2E2418` | 主要文字（深棕，非純黑） |
| muted | `#7A6A56` | 次要文字 |
| border | `#DDCEB8` | 分隔線 |

### Dark Mode (Sun Dark)
| Token | Hex | 用途 |
|-------|-----|------|
| accent | `#F4A08A` | 提亮的 coral |
| background | `#1E1A16` | 深棕底色 |
| secondary | `#2A2520` | 抬高表面 |
| foreground | `#EAE2D6` | 主要文字（暖白） |
| muted | `#B0A698` | 次要文字（WCAG AA 4.5:1） |

### Semantic Colors
| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| destructive | `#C83030` | `#E8A0A0` | 刪除、錯誤 |
| success | `#3D8E5A` | — | 成功、確認 |
| warning | `#B8860B` | — | 警告 |
| info | `#2870A0` | — | 資訊提示 |

### Color Themes（6 套）
使用者可切換主題，每套覆寫所有 color token：
| 主題 | 個性 | 強調色 |
|------|------|--------|
| 陽光 Sun（預設） | 溫暖沙土 | `#E86A4A` coral |
| 天空 Sky | 清新海藍 | `#4A90D9` |
| 禪 Zen | 寧靜低飽和 | `#6B8E7B` sage |
| 森林 Forest | 深綠自然 | `#3D7A4A` |
| 櫻花 Sakura | 粉紅柔美 | `#D4739A` |
| 夜空 Night | 深邃星空 | `#7B8FCC` |

## Spacing

### Base Unit
4px grid — 所有間距為 4 的倍數。

### Scale
| Token | Value | 用途 |
|-------|-------|------|
| half | 2px | 微調 |
| 1 | 4px | 最小間距 |
| 2 | 8px | 元素內 padding |
| 3 | 12px | 小間隔 |
| 4 | 16px | 標準 padding（= padding-h） |
| 5 | 20px | 中間隔 |
| 6 | 24px | section 間距 |
| 8 | 32px | 大間隔 |
| 10 | 40px | 特大間隔 |
| 12 | 48px | nav 高度 |
| 16 | 64px | 極大間隔 |

### Key Layout Measurements
| Token | Value | 用途 |
|-------|-------|------|
| padding-h | 16px | 頁面水平 padding |
| tap-min | 44px | 最小觸控目標（Apple HIG） |
| page-max-w | min(60vw, 900px) | 內容最大寬度 |
| nav-h | 48px | 導航列高度 |
| content-max-w | 720px | 文字內容最大寬度 |
| info-panel-w | 280px | 桌面版側邊 panel |
| fab-size | 56px | 浮動按鈕 |

## Layout
- **Approach:** Mobile-first responsive
- **Grid:** Single column（手機）→ content + side panel（桌面 ≥768px）
- **Max content width:** 900px（頁面）/ 720px（文字內容）
- **Border radius scale:**
  | Token | Value | 用途 |
  |-------|-------|------|
  | xs | 4px | input、小元素 |
  | sm | 8px | 按鈕、badge |
  | md | 12px | 卡片 |
  | lg | 16px | panel、modal |
  | full | 9999px | 圓形（avatar、pill） |

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
  | fast | 150ms | 微互動（toggle、hover） |
  | nav-fade | 200ms | 導航元素淡入淡出 |
  | normal | 250ms | 標準過渡 |
  | slow | 350ms | 入場動畫、skeleton |
  | sheet-close | 280ms | sheet 收合 |
  | indicator | 350ms | 指示器移動 |
  | sheet-open | 420ms | sheet 展開 |

## Material & Effects
- **Glass:** 毛玻璃效果用於 nav、toast、sheet
  - Nav: `background: color-mix(in srgb, background 72%, transparent)` + `backdrop-filter: blur(6px)`
  - Toast: `background: color-mix(in srgb, secondary 85%, transparent)`
  - Timeline card: `background: color-mix(in srgb, background 92%, transparent)` + blur(6px)
- **Shadow scale:**
  | Token | Value | 用途 |
  |-------|-------|------|
  | sm | `0 1px 4px rgba(46,36,24,0.08)` | 微妙抬升 |
  | md | `0 4px 16px rgba(46,36,24,0.12)` | 卡片 |
  | lg | `0 6px 20px rgba(46,36,24,0.18)` | 浮層、toast |
- **Focus ring:** `0 0 0 2px accent` — 鍵盤導航可見性

## Icons
- **Approach:** Inline SVG（不用 icon font）
- **Size:** 跟隨 font-size（`width: 1em; height: 1em`）
- **Style:** 統一描邊風格，不用填充
- **Color:** 繼承 `currentColor`

## Accessibility
- **Touch target:** 最小 44x44px（Apple HIG）
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（muted 色已調整確保達標）
- **Focus:** 所有互動元素有 focus-visible ring
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks

## Design Principles（開發時參考）
1. **原生 app 感** — 看起來像 iOS app，不像網頁。Large Title、spring easing、毛玻璃
2. **溫暖不冷漠** — 暖色調、手寫風 Logo、圓角。旅行是快樂的事
3. **無邊框設計** — 不用 border 區分區域，用 background color + shadow + spacing
4. **減法設計** — 能不加的 UI 就不加。行程資訊是主角，UI 是配角
5. **旅行優先** — 手機、弱網、戶外陽光下都要好用。字體大、對比高、載入快

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | System font stack | 旅行中網路不穩，zero web font loading delay |
| 2026-03-22 | Apple HIG type scale | 使用者以 iOS 為主，原生感最重要 |
| 2026-03-24 | Caveat for Logo | 手寫風格符合旅行手帳主題 |
| 2026-03-25 | 6 color themes | 個人化體驗，每個旅伴可選自己喜歡的風格 |
| 2026-03-26 | Tailwind CSS 4 + tokens.css | 單一 CSS 檔案管理所有 design token |
| 2026-03-29 | DESIGN.md created | 從 tokens.css 提取文件化，by /design-consultation |
