## ADDED Requirements

### Requirement: 語意色 CSS 變數定義

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 中定義以下語意色 CSS 變數：

| 變數 | Light 值 | Dark 值 | 用途 |
|------|----------|---------|------|
| `--error` | `#D32F2F` | `#FCA5A5` | 錯誤/警告文字色 |
| `--error-bg` | `#FFEBEE` | `rgba(220, 38, 38, 0.12)` | 錯誤/警告背景色 |
| `--success` | `#10B981` | `#6EE7B7` | 成功/開啟狀態色 |

#### Scenario: Light mode 語意色變數值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--error` SHALL 為 `#D32F2F`、`--error-bg` SHALL 為 `#FFEBEE`、`--success` SHALL 為 `#10B981`

#### Scenario: Dark mode 語意色變數值正確

- **WHEN** 頁面有 `body.dark` class
- **THEN** `--error` SHALL 為 `#FCA5A5`、`--error-bg` SHALL 為 `rgba(220, 38, 38, 0.12)`、`--success` SHALL 為 `#6EE7B7`

---

### Requirement: 錯誤元素使用語意色變數

系統 SHALL 將以下元素的顏色改為引用語意色變數：

| 選擇器 | 屬性 | 值 |
|--------|------|-----|
| `.trip-warnings` | `background` | `var(--error-bg)` |
| `.trip-warnings` | `color` | `var(--error)` |
| `.trip-warning-item` | `background` | `var(--error-bg)` |
| `.trip-error` | `color` | `var(--error)` |
| `.driving-stats-badge` | `background` | `var(--error)` |
| `.edit-status.error` | `color` | `var(--error)` |
| `.edit-status.success` | `color` | `var(--success)` |
| `.status-dot.open` | `background` | `var(--success)` |

#### Scenario: 警告區塊在 light mode 使用語意色

- **WHEN** 頁面為 light mode 且渲染 `.trip-warnings`
- **THEN** 背景色 SHALL 為 `var(--error-bg)`（`#FFEBEE`）、文字色 SHALL 為 `var(--error)`（`#D32F2F`）

#### Scenario: 警告區塊在 dark mode 使用語意色

- **WHEN** 頁面為 dark mode 且渲染 `.trip-warnings`
- **THEN** 背景色 SHALL 為 `var(--error-bg)`（`rgba(220, 38, 38, 0.12)`）、文字色 SHALL 為 `var(--error)`（`#FCA5A5`）

#### Scenario: 成功狀態點在 dark mode 使用語意色

- **WHEN** 頁面為 dark mode 且渲染 `.status-dot.open`
- **THEN** 背景色 SHALL 為 `var(--success)`（`#6EE7B7`）

#### Scenario: 行程錯誤在 dark mode 可讀

- **WHEN** 頁面為 dark mode 且渲染 `.trip-error`
- **THEN** 文字色 SHALL 為 `var(--error)`（`#FCA5A5`），在深色背景上對比度充足
