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

#### Scenario: light mode CSS 變數值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--accent` SHALL 為 `#C4704F`、`--sand` SHALL 為 `#C4704F`、`--blue` SHALL 解析為與 `--accent` 相同的值

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

#### Scenario: Day header 使用 accent 色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `.day-header`
- **THEN** 元素背景色 SHALL 顯示為 `var(--accent)`（`#C4704F`），文字色 SHALL 顯示為 `var(--bg)`（`#FAF9F5`）

#### Scenario: 卡片元素背景色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `#tripContent section`
- **THEN** 元素背景色 SHALL 顯示為 `var(--card-bg)`（`#F5F0E8`）
