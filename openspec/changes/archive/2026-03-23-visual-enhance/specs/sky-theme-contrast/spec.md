## ADDED Requirements

### Requirement: 晴空主題淺色 CSS 變數色差加大

系統 SHALL 將 `css/shared.css` 中 `body.theme-sky`（light mode）的以下七個 CSS 變數更新為對比度更高的值，同時維持主背景 `--bg: #FFF9F0` 不變：

| 變數 | 舊值 | 新值 |
|------|------|------|
| `--accent` | `#3B88B8` | `#2870A0` |
| `--accent-bg` | `#D5E8F5` | `#B8D4E8` |
| `--accent-subtle` | `#E5F0F8` | `#D0E4F2` |
| `--border` | `#D0E4EE` | `#A0C0D8` |
| `--text-muted` | `#7A9AAA` | `#587888` |
| `--bg-secondary` | `#F0F7FA` | `#E0EDF5` |
| `--bg-tertiary` | `#E0EEF4` | `#C8DDE8` |

`body.theme-sky.dark` 中的所有變數 SHALL 維持不變。

#### Scenario: 晴空 light mode accent 色深化

- **WHEN** 頁面套用 `body.theme-sky`（無 `.dark` class）
- **THEN** `--accent` 解析值 SHALL 為 `#2870A0`，不再為 `#3B88B8`

#### Scenario: 晴空 light mode bg-secondary 深化

- **WHEN** 頁面套用 `body.theme-sky`（無 `.dark` class）
- **THEN** `--bg-secondary` 解析值 SHALL 為 `#E0EDF5`，不再為 `#F0F7FA`

#### Scenario: 晴空 light mode border 深化

- **WHEN** 頁面套用 `body.theme-sky`（無 `.dark` class）
- **THEN** `--border` 解析值 SHALL 為 `#A0C0D8`，不再為 `#D0E4EE`

#### Scenario: 晴空 light mode text-muted 深化

- **WHEN** 頁面套用 `body.theme-sky`（無 `.dark` class）
- **THEN** `--text-muted` 解析值 SHALL 為 `#587888`，不再為 `#7A9AAA`

#### Scenario: 晴空 dark mode 不受影響

- **WHEN** 頁面套用 `body.theme-sky.dark`
- **THEN** `--accent` SHALL 維持 `#7EC0E8`，其他 dark mode 變數亦維持不變

#### Scenario: 晴空 light mode 主背景維持暖白

- **WHEN** 頁面套用 `body.theme-sky`（無 `.dark` class）
- **THEN** `--bg` 解析值 SHALL 仍為 `#FFF9F0`，不得改變
