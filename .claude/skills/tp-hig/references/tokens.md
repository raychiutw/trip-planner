# Design Tokens 速查表

所有 token 定義在 `css/shared.css :root`，dark mode 覆寫在 `body.dark`。

## Color

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--accent` | `#C4704F` | `#D4845E` | 主色 |
| `--accent-subtle` | `#F9F3EF` | `#252220` | 選取背景 |
| `--accent-bg` | `#F5EDE8` | `#3D2F27` | 卡片/按鈕背景 |
| `--bg` | `#FAF9F5` | `#1A1A1A` | 頁面底色 |
| `--bg-secondary` | `#F5F0E8` | `#2B2B2B` | section 卡片 |
| `--bg-tertiary` | `#F0EDE8` | `#3D3A35` | 深層底色 |
| `--hover-bg` | `#EDE8E0` | `#3D3A37` | hover 狀態 |
| `--text` | `#1A1A1A` | `#E8E8E8` | 主文字 |
| `--text-muted` | `#6B6B6B` | `#9B9B9B` | 次要文字 |
| `--text-on-accent` | `#FFFFFF` | `#FFFFFF` | accent 上的白字 |
| `--border` | `#E5E0DA` | `#3A3A3A` | 分隔線 |
| `--error` | `#D32F2F` | `#FCA5A5` | 錯誤 |
| `--error-bg` | `#FFEBEE` | `rgba(220,38,38,0.12)` | 錯誤背景 |
| `--success` | `#10B981` | `#6EE7B7` | 成功 |
| `--overlay` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.55)` | 遮罩 |

## Typography（11 級 Apple text style）

| Token | 值 | 對應 |
|-------|----|------|
| `--fs-large-title` | `2.125rem` | 大標題 |
| `--fs-title` | `1.75rem` | 標題 |
| `--fs-title2` | `1.375rem` | 標題 2 |
| `--fs-title3` | `1.25rem` | 標題 3 |
| `--fs-headline` | `1.0625rem` | headline |
| `--fs-body` | `1.0625rem` | 本文 |
| `--fs-callout` | `1rem` | callout |
| `--fs-subheadline` | `0.9375rem` | 副標 |
| `--fs-footnote` | `0.8125rem` | 註腳 |
| `--fs-caption` | `0.75rem` | 說明 |
| `--fs-caption2` | `0.6875rem` | 小說明 |

Line height：`--lh-tight: 1.2`、`--lh-normal: 1.5`、`--lh-relaxed: 1.7`

## Spacing（4pt grid）

所有 margin / padding / gap 的 px 值必須為 **4 的倍數**。

| Token | 值 | 用途 |
|-------|----|------|
| `--padding-h` | `16px`（≥768px: `20px`） | 水平內距 |
| `--nav-h` | `48px` | 導航列高 |
| `--content-max-w` | `720px` | 內容最大寬 |
| `--info-panel-w` | `280px` | 桌機側欄寬 |
| `--tap-min` | `44px` | 最小觸控目標 |

## Radius（5 級）

| Token | 值 |
|-------|----|
| `--radius-xs` | `4px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-full` | `99px` |

## Motion（3 級）

| Token | 值 |
|-------|----|
| `--duration-fast` | `150ms` |
| `--duration-normal` | `250ms` |
| `--duration-slow` | `350ms` |
| `--ease-apple` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

## Shadow

| Token | 值 |
|-------|----|
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` |
| `--shadow-lg` | `0 6px 16px rgba(0,0,0,0.2)` |
| `--shadow-ring` | `0 0 0 2px var(--accent)` |
