# Design Tokens 速查表

所有 token 定義在 `css/shared.css` 的 `@theme` 區塊（預設 = Sun Light）。
6 組主題各有 Light / Dark 變體，透過 `body.theme-{name}` + `body.theme-{name}.dark` 覆寫。

**權威來源**：`css/shared.css`。本文件為速查摘要。

## Color（6 主題 × 2 模式）

### 主題一覽

| 主題 | class | Light accent | Light 背景 | Dark accent | Dark 背景 | 風格 |
|------|-------|-------------|-----------|-------------|----------|------|
| 陽光 (Sun) | `theme-sun` | `#E86A4A` 暖橘 | `#FBF3E8` 奶油 | `#F4A08A` | `#1E1A16` | 預設，旅行手帳 |
| 晴空 (Sky) | `theme-sky` | `#2870A0` 藍 | `#FFF9F0` 暖白 | `#7EC0E8` | `#161C20` | 清爽海洋 |
| 和風 (Zen) | `theme-zen` | `#9A6B50` 褐 | `#F5F0E8` 暖灰 | `#D4A88E` | `#1B1918` | 侘寂和紙 |
| 森林 (Forest) | `theme-forest` | `#4A8C5C` 綠 | `#F0F5EE` 綠底 | `#7EC89A` | `#141A16` | 自然森林 |
| 櫻花 (Sakura) | `theme-sakura` | `#D4708A` 粉 | `#FFF5F7` 粉底 | `#F0A0B8` | `#1C1618` | 浪漫櫻花 |
| 星夜 (Night) | `theme-night` | `#6B6B6B` 灰 | `#F5F5F5` 中性 | `#A0A0A0` | `#111111` | 極簡單色 |

另有 `theme-print`（列印專用，無 dark 變體）。

### Semantic Token 對照（以預設 Sun 主題為例）

| Token | Sun Light | Sun Dark | 用途 |
|-------|-----------|----------|------|
| `--color-accent` | `#E86A4A` | `#F4A08A` | 主色 |
| `--color-accent-subtle` | `#FDE8E2` | `#2A1E18` | 選取背景 |
| `--color-accent-bg` | `#F9DDD4` | `#3D2A20` | 卡片/按鈕背景 |
| `--color-background` | `#FBF3E8` | `#1E1A16` | 頁面底色 |
| `--color-secondary` | `#F0DABC` | `#2A2520` | 浮起表面（卡片、面板） |
| `--color-tertiary` | `#E5CBA8` | `#36302A` | 凹陷表面（輸入框） |
| `--color-hover` | `#EACFAE` | `#332C26` | hover 狀態 |
| `--color-foreground` | `#2E2418` | `#EAE2D6` | 主文字 |
| `--color-muted` | `#7A6A56` | `#B0A698` | 次要文字 |
| `--color-accent-foreground` | `#FBF3E8` | `#1E1A16` | accent 上的反色字 |
| `--color-border` | `#DDCEB8` | `#3E3830` | 分隔線 |
| `--color-destructive` | `#C83030` | `#E8A0A0` | 錯誤/危險 |
| `--color-destructive-bg` | `#FDECEC` | `rgba(212,64,64,0.15)` | 錯誤背景 |
| `--color-success` | `#3D8E5A` | `#7EC89A` | 成功 |
| `--color-success-bg` | `rgba(61,142,90,0.12)` | `rgba(126,200,154,0.15)` | 成功背景 |
| `--color-warning` | `#B8860B` | `#F0D060` | 警告 |
| `--color-warning-bg` | `rgba(184,134,11,0.12)` | `rgba(240,208,96,0.15)` | 警告背景 |
| `--color-info` | `#2870A0` | `#7EC0E8` | 資訊 |
| `--color-info-bg` | `rgba(40,112,160,0.12)` | `rgba(126,192,232,0.15)` | 資訊背景 |
| `--color-disabled` | `#B0A090` | `#605850` | 不可用 |
| `--color-disabled-foreground` | `#D0C8BC` | `#3E3830` | 不可用文字 |
| `--color-overlay` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.55)` | 遮罩 |

### 品牌色（不隨主題變化）

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-google-maps` | `#4285F4` | Google Maps icon |
| `--color-naver-maps` | `#03C75A` | Naver Maps icon |

### 主題性格 token

| Token | Sun | Zen | 其他 | 用途 |
|-------|-----|-----|------|------|
| `--theme-header-gradient` | `none` | `none` | 各有漸層 | section header 背景 |
| `--theme-font-weight-headline` | `semibold` | `medium` | `semibold` | headline 粗細 |
| `--theme-line-height-body` | `1.5` | `1.7` | `1.5` | 本文行高 |
| `--theme-section-gap` | `24px` | `32px` | `24px` | section 間距 |

### 使用原則

- **一律用 `var(--color-*)` token**，禁止硬編碼色碼
- 6 組主題的 accent / background / surface 各不同，硬編碼會在切換主題時壞掉
- Dark mode 透過 token 覆寫自動生效，不需額外寫 `.dark` 規則（除非需要不同屬性值）

## Typography（11 級 Apple text style）

| Token | 值 | 對應 |
|-------|----|------|
| `--font-size-large-title` | `2.125rem` | 大標題 |
| `--font-size-title` | `1.75rem` | 標題 |
| `--font-size-title2` | `1.375rem` | 標題 2 |
| `--font-size-title3` | `1.25rem` | 標題 3 |
| `--font-size-headline` | `1.0625rem` | headline（weight: semibold） |
| `--font-size-body` | `1.0625rem` | 本文（weight: regular） |
| `--font-size-callout` | `1rem` | callout |
| `--font-size-subheadline` | `0.9375rem` | 副標 |
| `--font-size-footnote` | `0.8125rem` | 註腳 |
| `--font-size-caption` | `0.75rem` | 說明 |
| `--font-size-caption2` | `0.6875rem` | 小說明 |

Font family：`--font-family-system`（`-apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`）

Font weight：`--font-weight-light: 300` / `normal: 400` / `medium: 500` / `semibold: 600` / `bold: 700`

Line height：`--line-height-tight: 1.2` / `--line-height-normal: 1.5` / `--line-height-relaxed: 1.7`

## Spacing（4pt grid）

所有 margin / padding / gap 的 px 值必須為 **4 的倍數**。

| Token | 值 | 用途 |
|-------|----|------|
| `--spacing-half` | `2px` | 微間距（例外） |
| `--spacing-1` | `4px` | 最小間距 |
| `--spacing-2` | `8px` | 元件內間距 |
| `--spacing-3` | `12px` | 卡片 padding |
| `--spacing-4` | `16px` | 標準 padding |
| `--spacing-5` | `20px` | 較大間距 |
| `--spacing-6` | `24px` | section 間距 |
| `--spacing-8` | `32px` | 大容器 |
| `--spacing-10` | `40px` | header |
| `--spacing-12` | `48px` | 大區塊 |
| `--spacing-16` | `64px` | 最大間距 |

### 佈局 token

| Token | 值 | 用途 |
|-------|----|------|
| `--padding-h` | `16px`（≥768px: `20px`） | 水平內距 |
| `--nav-h` | `48px` | 導航列高 |
| `--content-max-w` | `720px` | 內容最大寬 |
| `--info-panel-w` | `280px` | 桌機側欄寬 |
| `--tap-min` | `44px` | 最小觸控目標 |
| `--fab-size` | `56px` | FAB 按鈕大小 |

## Radius（5 級）

| Token | 值 |
|-------|----|
| `--radius-xs` | `4px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-full` | `9999px` |

## Motion

### 基礎 3 級

| Token | 值 |
|-------|----|
| `--transition-duration-fast` | `150ms` |
| `--transition-duration-normal` | `250ms` |
| `--transition-duration-slow` | `350ms` |
| `--transition-timing-function-apple` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

### Sheet / 特殊動畫

| Token | 值 | 用途 |
|-------|----|------|
| `--ease-spring` | `cubic-bezier(0.32, 1.28, 0.60, 1.00)` | 彈性開啟 |
| `--ease-sheet-close` | `cubic-bezier(0.4, 0, 1, 1)` | sheet 關閉 |
| `--duration-sheet-open` | `420ms` | sheet 開啟 |
| `--duration-sheet-close` | `280ms` | sheet 關閉 |
| `--duration-tap` | `80ms` | 觸控回饋 |
| `--duration-nav-fade` | `200ms` | nav 淡入淡出 |
| `--duration-indicator` | `350ms` | 指示器動畫 |

## Shadow

| Token | Sun Light 值 | 用途 |
|-------|-------------|------|
| `--shadow-md` | `0 4px 16px rgba(46,36,24,0.12)` | 卡片陰影 |
| `--shadow-lg` | `0 6px 20px rgba(46,36,24,0.18)` | 浮動元素 |
| `--shadow-ring` | `0 0 0 2px var(--color-accent)` | focus ring |

Shadow 的 rgba 色值隨主題變化（每個主題用不同的陰影色調）。Dark mode 統一使用 `rgba(0,0,0,0.20/0.30)`。

## Z-index

| Token | 值 | 用途 |
|-------|----|------|
| `--z-day-header` | `100` | 日期 header |
| `--z-sticky-nav` | `200` | 導航列 |
| `--z-fab` | `300` | FAB 按鈕 |
| `--z-quick-panel` | `350` | 快速面板 |
| `--z-info-sheet-backdrop` | `400` | sheet 遮罩 |
| `--z-info-sheet` | `401` | sheet 面板 |
| `--z-print-exit` | `9999` | 列印退出按鈕 |
