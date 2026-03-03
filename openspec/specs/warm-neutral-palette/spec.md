## MODIFIED Requirements

### Requirement: 全站 CSS 色彩變數定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 兩個區塊中集中定義所有色彩 CSS variables，light mode 與 dark mode 各一套，其他 CSS 檔案 MUST 只引用這些變數，不得自行宣告色彩值。

擴充變數列表：

| 變數 | Light 值 | Dark 值 | 用途 |
|------|----------|---------|------|
| `--bg` | `#FAF9F5` | `#1A1A1A` | body 背景 |
| `--card-bg` | `#F5F0E8` | `#2B2B2B` | 卡片背景 |
| `--hover-bg` | `#EDE8E0` | `#3D3A37` | 互動 hover 底色 |
| `--bubble-bg` | `#F0EDE8` | `#3D3A35` | 聊天氣泡背景 |
| `--text` | `#1A1A1A` | `#E8E8E8` | 主要文字 |
| `--text-muted` | `#6B6B6B` | `#9B9B9B` | 次要文字 |
| `--border` | `#E5E0DA` | `#3A3A3A` | 邊線色 |
| `--accent` | `#C4704F` | `#D4845E` | 強調色 |
| `--gray` | `#6B6B6B` | `#9B9590` | 裝飾灰 |
| `--gray-light` | `#EDEBE8` | `#343130` | 淺灰背景 |
| `--white` | `#FAF9F5` | `#292624` | body 背景別名 |
| `--error` | `#D32F2F` | `#FCA5A5` | 錯誤文字 |
| `--error-bg` | `#FFEBEE` | `rgba(220,38,38,0.12)` | 錯誤背景 |
| `--success` | `#10B981` | `#6EE7B7` | 成功狀態 |

#### Scenario: Light mode 色彩變數存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在以下變數及對應值：`--bg: #FAF9F5`、`--card-bg: #F5F0E8`、`--hover-bg: #EDE8E0`、`--accent: #C4704F`、`--gray-light: #EDEBE8`、`--error: #D32F2F`、`--error-bg: #FFEBEE`、`--success: #10B981`

#### Scenario: Dark mode 色彩變數存在且值正確

- **WHEN** `<body>` 元素含有 `.dark` class
- **THEN** `body.dark` 區塊 SHALL 覆蓋以下變數：`--hover-bg: #3D3A37`、`--error: #FCA5A5`、`--error-bg: rgba(220, 38, 38, 0.12)`、`--success: #6EE7B7`

---

### Requirement: 深色模式覆蓋規範

系統 SHALL 確保所有 `body.dark` CSS 覆蓋遵守以下規則：

1. 背景色 MUST 引用 CSS 變數，不得硬寫十六進位色碼
2. 不得使用 `!important` 除非在 print mode
3. 深色覆蓋的 specificity MUST 精確匹配目標狀態（如 `:disabled`），不得過寬覆蓋

#### Scenario: info-header 深色覆蓋不使用 !important

- **WHEN** 頁面為 dark mode 且渲染 `.info-header`
- **THEN** 背景色 SHALL 由 CSS 變數控制（`var(--hover-bg)` 或 `var(--card-bg)`），不得使用 `!important`

#### Scenario: edit-send-btn 深色覆蓋限定 disabled

- **WHEN** 頁面為 dark mode 且 `.edit-send-btn` 為 enabled 狀態
- **THEN** 按鈕背景色 SHALL 為 `var(--accent)`（`#D4845E`），不被 `body.dark` 覆蓋影響

---

### Requirement: stickyNav 與 Day 1 間隔

系統 SHALL 確保 `.sticky-nav` 與第一個 Day section 之間有視覺間隔。

#### Scenario: stickyNav 下方有間隔

- **WHEN** 頁面渲染 `.sticky-nav` 和第一個 `#tripContent section`
- **THEN** 兩者之間 SHALL 有至少 `12px` 的間隔（通過 margin 實現）

---

### Requirement: 深色模式 info-box 統一

系統 SHALL 統一 `.info-box` 各類型（`.reservation`、`.parking`、`.souvenir`、`.restaurants`）在深色模式下的背景色，使用相同的 CSS 變數而非各自硬寫不同色碼。

#### Scenario: info-box 類型在 dark mode 背景統一

- **WHEN** 頁面為 dark mode 且渲染任何 `.info-box` 類型
- **THEN** 所有 `.info-box` 子類型背景色 SHALL 使用同一個 CSS 變數（`var(--blue-light)` 或 `var(--card-bg)`），不得各自硬寫不同色碼

---

### Requirement: sidebar 與 drawer 深色模式背景

系統 SHALL 在深色模式中使用 `var(--card-bg)` 作為 `.sidebar` 與 `.menu-drawer` 的背景色，使其與頁面背景（`--bg`）有層級區分。

#### Scenario: sidebar 在 dark mode 使用 card-bg

- **WHEN** 頁面為 dark mode 且顯示 `.sidebar`
- **THEN** 背景色 SHALL 為 `var(--card-bg)`（`#2B2B2B`），不得為 `var(--bg)`（`#1A1A1A`）

#### Scenario: menu-drawer 在 dark mode 使用 card-bg

- **WHEN** 頁面為 dark mode 且開啟 `.menu-drawer`
- **THEN** 背景色 SHALL 為 `var(--card-bg)`（`#2B2B2B`），與頁面背景有層級區分
