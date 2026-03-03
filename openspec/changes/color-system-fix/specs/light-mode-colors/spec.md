## MODIFIED Requirements

### Requirement: CSS 變數

系統 SHALL 在 `css/shared.css` 的 `:root` 中定義以下 light mode 色彩變數（取代舊有值）：

| 變數 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#FAF9F5` | 頁面背景（body） |
| `--card-bg` | `#F5F0E8` | 卡片 / sidebar / info-panel 背景 |
| `--bubble-bg` | `#F0EDE8` | edit.html 使用者輸入氣泡背景 |
| `--text` | `#1A1A1A` | 主要文字色 |
| `--text-muted` | `#6B6B6B` | 次要文字色 |
| `--border` | `#E5E0DA` | 邊線色 |
| `--accent` | `#C4704F` | Day header、按鈕、focus ring 等強調色 |
| `--sand` | `#C4704F` | accent 同義別名 |
| `--blue` | `var(--accent)` | 向後相容別名 |
| `--gray-light` | `#EDEBE8` | 淺灰背景（SHALL 與 `--white` 值不同） |
| `--white` | `#FAF9F5` | body 背景色別名 |

#### Scenario: light mode CSS 變數值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--accent` SHALL 為 `#C4704F`、`--gray-light` SHALL 為 `#EDEBE8`（不得與 `--white` 相同）

---

### Requirement: 元素對照

系統 SHALL 將以下元素的背景色指向 shared.css 中的色彩變數：

| 選擇器 | 背景色 |
|--------|--------|
| `body` | `var(--bg)` |
| `#tripContent section` | `var(--card-bg)` |
| `.info-card` | `var(--card-bg)` |
| `footer` | `var(--card-bg)` |
| `.day-header` | `var(--accent)`，文字 `var(--bg)` |
| `.sidebar` | `var(--card-bg)` |
| `.info-panel` | `var(--card-bg)` |
| `.sticky-nav` | `var(--card-bg)` |
| `.menu-drawer` | `var(--card-bg)` |
| `.edit-input-card` | `var(--white)` |

#### Scenario: Day header 使用 accent 色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `.day-header`
- **THEN** 元素背景色 SHALL 顯示為 `var(--accent)`（`#C4704F`），文字色 SHALL 顯示為 `var(--bg)`（`#FAF9F5`）

#### Scenario: 卡片元素背景色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `#tripContent section`
- **THEN** 元素背景色 SHALL 顯示為 `var(--card-bg)`（`#F5F0E8`）

#### Scenario: menu-drawer 背景可區分（light mode）

- **WHEN** 頁面為 light mode 且開啟 `.menu-drawer`
- **THEN** 選單背景色 SHALL 為 `var(--card-bg)`（`#F5F0E8`），與 body 背景（`#FAF9F5`）有明顯區分

#### Scenario: edit-input-card 使用暖白色

- **WHEN** 頁面為 light mode 且渲染 `.edit-input-card`
- **THEN** 背景色 SHALL 為 `var(--white)`（`#FAF9F5`），不得為純白 `#FFFFFF`

---

### Requirement: 邊線與分隔線可見性

系統 SHALL 確保以下邊線在 light mode 中可見：

| 選擇器 | 屬性 | 值 |
|--------|------|-----|
| `.sidebar` | `border-right` | `1px solid var(--border)` |
| `.color-mode-preview` | `border` | `1px solid var(--border)` |
| `.sheet-handle` | `background` | `var(--border)` |

#### Scenario: sidebar 邊線在 light mode 可見

- **WHEN** 頁面為 light mode 且顯示 `.sidebar`
- **THEN** 右邊線 SHALL 使用 `var(--border)`（`#E5E0DA`），在 `--bg`（`#FAF9F5`）背景上清楚可見

#### Scenario: sheet-handle 在 light mode 可見

- **WHEN** 頁面為 light mode 且開啟底部彈窗
- **THEN** `.sheet-handle` 背景色 SHALL 為 `var(--border)`（`#E5E0DA`），在 `--card-bg` 上可見

---

### Requirement: 文字對比度

系統 SHALL 確保次要文字在 light mode 有足夠對比度，不得使用 `opacity` 降低已低對比的文字：

| 選擇器 | 改為 |
|--------|------|
| `.hw-update-time` | `color: var(--text-muted)`（移除 `opacity: 0.7`） |
| `.countdown-date` | `color: var(--text-muted)`（移除 `opacity: 0.7`） |

#### Scenario: 天氣更新時間文字對比度

- **WHEN** 頁面為 light mode 且渲染 `.hw-update-time`
- **THEN** 文字色 SHALL 為 `var(--text-muted)`（`#6B6B6B`），不得有額外 opacity 降低

---

### Requirement: apple map-link 使用 CSS 變數

系統 SHALL 將 `.map-link.apple` 的文字色與 SVG fill 改為 CSS 變數：

| 選擇器 | 屬性 | 原值 | 改為 |
|--------|------|------|------|
| `.map-link.apple` | `color` | `#333` | `var(--text)` |
| `.map-link .apple-icon svg` | `fill` | `#333` | `var(--text)` |

#### Scenario: apple map-link 在 light mode 使用 --text

- **WHEN** 頁面為 light mode 且渲染 `.map-link.apple`
- **THEN** 文字色 SHALL 為 `var(--text)`（`#1A1A1A`），SVG fill 亦 SHALL 為 `var(--text)`
