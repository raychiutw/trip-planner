# Design Tokens 速查表

所有 token 定義在 `css/shared.css :root`，dark mode 覆寫在 `body.dark`。

## Color（旅行手帳風 — 墨綠 + 奶油紙）

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--accent` | `#4A7C59` | `#7BC48E` | 主色（墨綠） |
| `--accent-subtle` | `#EEF4EF` | `#1E2A21` | 選取背景 |
| `--accent-bg` | `#E3EDE5` | `#243328` | 卡片/按鈕背景 |
| `--bg` | `#FBF7F0` | `#1C1B18` | 頁面底色（奶油紙/深皮革） |
| `--bg-secondary` | `#F3EDE2` | `#282622` | section 卡片（牛皮紙） |
| `--bg-tertiary` | `#EBE4D6` | `#34312B` | 深層底色（舊紙） |
| `--hover-bg` | `#E6DFCF` | `#36332D` | hover 狀態 |
| `--text` | `#2C2416` | `#E8E2D6` | 主文字（深褐墨/奶油字） |
| `--text-muted` | `#8A7E6E` | `#9B9588` | 次要文字（褪色墨） |
| `--text-on-accent` | `#FFFFFF` | `#1C1B18` | accent 上的反色字 |
| `--border` | `#D8CEBC` | `#3D3A34` | 分隔線（紙邊） |
| `--error` | `#C44040` | `#E8A0A0` | 錯誤 |
| `--error-bg` | `#FDECEC` | `rgba(196,64,64,0.15)` | 錯誤背景 |
| `--success` | `#4A7C59` | `#7BC48E` | 成功（同 accent） |
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
| `--shadow-md` | `0 4px 16px rgba(44,36,22,0.10)` |
| `--shadow-lg` | `0 6px 20px rgba(44,36,22,0.16)` |
| `--shadow-ring` | `0 0 0 2px var(--accent)` |
