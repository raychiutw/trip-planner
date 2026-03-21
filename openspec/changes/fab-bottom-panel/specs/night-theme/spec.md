## ADDED Requirements

### Requirement: night 主題色彩定義
系統 SHALL 在 `css/shared.css` 中定義 `.theme-night` 色彩 token，取代 `.theme-ocean`。night 主題為黑/炭灰無彩色系。

Light mode（`.theme-night`）：
| Token | 值 |
|-------|-----|
| `--color-accent` | `#6B6B6B` |
| `--color-accent-subtle` | `#F0F0F0` |
| `--color-accent-bg` | `#E8E8E8` |
| `--color-background` | `#F5F5F5` |
| `--color-secondary` | `#EBEBEB` |
| `--color-tertiary` | `#E0E0E0` |
| `--color-hover` | `#D5D5D5` |
| `--color-foreground` | `#1A1A1A` |
| `--color-muted` | `#808080` |
| `--color-border` | `#D5D5D5` |

Dark mode（`.theme-night.dark`）：
| Token | 值 |
|-------|-----|
| `--color-accent` | `#A0A0A0` |
| `--color-accent-subtle` | `rgba(160,160,160,0.12)` |
| `--color-accent-bg` | `rgba(160,160,160,0.08)` |
| `--color-background` | `#000000` |
| `--color-secondary` | `#1A1A1A` |
| `--color-tertiary` | `#2A2A2A` |
| `--color-hover` | `#333333` |
| `--color-foreground` | `#E5E5E5` |
| `--color-muted` | `#999999` |
| `--color-border` | `#333333` |

#### Scenario: night light mode token 正確
- **WHEN** body 有 `.theme-night` class 且無 `.dark` class
- **THEN** `--color-background` SHALL 為 `#F5F5F5`，`--color-accent` SHALL 為 `#6B6B6B`

#### Scenario: night dark mode 純黑背景
- **WHEN** body 有 `.theme-night.dark` class
- **THEN** `--color-background` SHALL 為 `#000000`（純黑，OLED 友善）

### Requirement: night 主題 meta theme-color
`useDarkMode.ts` 的 `THEME_COLORS` SHALL 包含 night 主題的 theme-color 值：`{ light: '#6B6B6B', dark: '#000000' }`。

#### Scenario: night 主題 meta 標籤正確
- **WHEN** 使用 night 主題且為 dark mode
- **THEN** `<meta name="theme-color">` SHALL 為 `#000000`

### Requirement: ocean 主題移除
系統 SHALL 移除 `.theme-ocean` 的所有 CSS 定義和 `THEME_COLORS.ocean`。`useDarkMode.ts` 的 `ColorTheme` type SHALL 不再包含 `'ocean'`。

#### Scenario: ocean CSS 不存在
- **WHEN** 靜態分析 `css/shared.css`
- **THEN** 不得存在 `.theme-ocean` 選擇器

#### Scenario: ocean type 不存在
- **WHEN** 檢查 `useDarkMode.ts` 的 `ColorTheme` type
- **THEN** 不得包含 `'ocean'` literal

### Requirement: ocean → night 自動遷移
`readColorTheme()` 函式 SHALL 將 localStorage 中的 `'ocean'` 值自動映射為 `'night'`，確保已選用 ocean 的使用者無感遷移。

#### Scenario: localStorage 有 ocean 時自動遷移
- **WHEN** localStorage `colorTheme` 為 `'ocean'`
- **THEN** `readColorTheme()` SHALL 回傳 `'night'`

### Requirement: 設定頁主題選擇器更新
設定頁（`SettingPage.tsx`）的主題選擇器 SHALL 顯示 night 主題（label「星夜」），取代 ocean。按鈕色彩 SHALL 使用 night 的 accent color（`#6B6B6B`）。

#### Scenario: 設定頁顯示星夜主題
- **WHEN** 設定頁載入
- **THEN** 主題選擇器 SHALL 顯示 6 個主題：陽光、晴空、和風、森林、櫻花、星夜
