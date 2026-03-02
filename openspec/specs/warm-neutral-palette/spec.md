## ADDED Requirements

### Requirement: 全站 CSS 色彩變數定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 兩個區塊中集中定義所有色彩 CSS variables，light mode 與 dark mode 各一套，其他 CSS 檔案 MUST 只引用這些變數，不得自行宣告色彩值。

#### Scenario: Light mode 色彩變數存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在以下變數及對應值：`--bg: #FFFFFF`、`--card-bg: #F5F0E8`、`--bubble-bg: #F0EDE8`、`--text: #1A1A1A`、`--text-muted: #6B6B6B`、`--border: #E5E0DA`、`--accent: #8B8580`

#### Scenario: Dark mode 色彩變數存在且值正確

- **WHEN** `<body>` 元素含有 `.dark` class
- **THEN** `body.dark` 區塊 SHALL 覆蓋以下變數：`--bg: #1A1A1A`、`--card-bg: #2B2B2B`、`--bubble-bg: #3D3A35`、`--text: #E8E8E8`、`--text-muted: #9B9B9B`、`--border: #3A3A3A`

#### Scenario: --blue 向後相容別名

- **WHEN** 任何 CSS 選擇器引用 `var(--blue)`
- **THEN** 顯示顏色 SHALL 等同於 `var(--accent)` 的值，因為 `--blue: var(--accent)` 別名存在於 `:root`

---

### Requirement: Day pills 與互動元素使用 accent 色

系統 SHALL 將所有 Day header 背景、focus ring、按鈕強調色改為引用 `var(--accent)`，不得硬編碼顏色值。

#### Scenario: Day header 背景色為 accent

- **WHEN** 行程頁面（`index.html`）渲染 `.day-header` 元素
- **THEN** 元素背景色 SHALL 顯示為 `var(--accent)`（`#8B8580` 暖灰）

#### Scenario: Focus ring 使用 accent 色

- **WHEN** 使用者以鍵盤聚焦互動按鈕（`.sidebar-toggle`、`.dh-menu`、`.dn`、`.menu-item`）
- **THEN** `:focus-visible` 的 `box-shadow` SHALL 使用 `var(--accent)` 作為 focus ring 顏色

---

### Requirement: 卡片與頁面背景色符合暖中性色系

系統 SHALL 確保各頁面卡片背景、頁面背景、邊線顏色均引用 shared.css 中定義的色彩變數，以呈現一致的暖中性風格。

#### Scenario: 卡片背景色（light mode）

- **WHEN** 頁面為 light mode（無 `.dark` class）且顯示 `section`、`.info-card`、`.sidebar`、`.info-panel`
- **THEN** 這些元素的背景色 SHALL 顯示為 `var(--card-bg)`（`#F5F0E8`）

#### Scenario: 頁面背景色（light mode）

- **WHEN** 頁面為 light mode
- **THEN** `body` 背景色 SHALL 顯示為 `var(--bg)`（`#FFFFFF`）

#### Scenario: 卡片背景色（dark mode）

- **WHEN** 頁面為 dark mode（含 `.dark` class）且顯示 `section`、`.info-card`
- **THEN** 這些元素的背景色 SHALL 顯示為 `var(--card-bg)`（`#2B2B2B`）

#### Scenario: edit.html 使用者氣泡背景色

- **WHEN** `edit.html` 頁面顯示使用者輸入的聊天氣泡（`.user-bubble` 或同等元素）
- **THEN** 氣泡背景色 SHALL 使用 `var(--bubble-bg)`（light: `#F0EDE8`，dark: `#3D3A35`）
