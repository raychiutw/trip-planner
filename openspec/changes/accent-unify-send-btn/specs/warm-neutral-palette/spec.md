## MODIFIED Requirements

### Requirement: 全站 CSS 色彩變數定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 兩個區塊中集中定義所有色彩 CSS variables，light mode 與 dark mode 各一套，其他 CSS 檔案 MUST 只引用這些變數，不得自行宣告色彩值。

#### Scenario: Light mode 色彩變數存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在以下變數及對應值：`--bg: #FAF9F5`、`--card-bg: #F5F0E8`、`--bubble-bg: #F0EDE8`、`--text: #1A1A1A`、`--text-muted: #6B6B6B`、`--border: #E5E0DA`、`--accent: #C4704F`、`--sand: #C4704F`

#### Scenario: Dark mode 色彩變數存在且值正確

- **WHEN** `<body>` 元素含有 `.dark` class
- **THEN** `body.dark` 區塊 SHALL 覆蓋以下變數：`--bg: #1A1A1A`、`--card-bg: #2B2B2B`、`--bubble-bg: #3D3A35`、`--text: #E8E8E8`、`--text-muted: #9B9B9B`、`--border: #3A3A3A`、`--accent: #D4845E`、`--sand: #D4A070`

#### Scenario: --blue 向後相容別名

- **WHEN** 任何 CSS 選擇器引用 `var(--blue)`
- **THEN** 顯示顏色 SHALL 等同於 `var(--accent)` 的值，因為 `--blue: var(--accent)` 別名存在於 `:root`

---

### Requirement: Day pills 與互動元素使用 accent 色

系統 SHALL 將所有 Day header 背景、focus ring、按鈕強調色改為引用 `var(--accent)`，不得硬編碼顏色值。

#### Scenario: Day header 背景色為 accent

- **WHEN** 行程頁面（`index.html`）渲染 `.day-header` 元素
- **THEN** 元素背景色 SHALL 顯示為 `var(--accent)`（`#C4704F` 赤陶橘）

#### Scenario: Focus ring 使用 accent 色

- **WHEN** 使用者以鍵盤聚焦互動按鈕（`.sidebar-toggle`、`.dh-menu`、`.dn`、`.menu-item`）
- **THEN** `:focus-visible` 的 `box-shadow` SHALL 使用 `var(--accent)` 作為 focus ring 顏色
