## MODIFIED Requirements

### Requirement: CSS 變數

系統 SHALL 在 `css/shared.css` 的 `:root` 中定義以下 light mode 色彩變數（取代舊有值）：

| 變數 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#FFFFFF` | 頁面背景（body） |
| `--card-bg` | `#F5F0E8` | 卡片 / sidebar / info-panel 背景 |
| `--bubble-bg` | `#F0EDE8` | edit.html 使用者輸入氣泡背景 |
| `--text` | `#1A1A1A` | 主要文字色 |
| `--text-muted` | `#6B6B6B` | 次要文字色 |
| `--border` | `#E5E0DA` | 邊線色 |
| `--accent` | `#8B8580` | Day header、按鈕、focus ring 等強調色 |
| `--blue` | `var(--accent)` | 向後相容別名（原 `#C4704F`，改為指向 `--accent`） |

#### Scenario: light mode CSS 變數值正確

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `:root` 中 `--card-bg` SHALL 為 `#F5F0E8`、`--accent` SHALL 為 `#8B8580`、`--blue` SHALL 解析為與 `--accent` 相同的值

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

#### Scenario: 卡片元素背景色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `#tripContent section`
- **THEN** 元素背景色 SHALL 顯示為 `var(--card-bg)`（`#F5F0E8`）

#### Scenario: Day header 使用 accent 色（light mode）

- **WHEN** 頁面為 light mode 且渲染 `.day-header`
- **THEN** 元素背景色 SHALL 顯示為 `var(--accent)`（`#8B8580`），文字色 SHALL 顯示為 `var(--bg)`（`#FFFFFF`）

---

### Requirement: Focus 樣式

所有互動按鈕（`.sidebar-toggle`、`.dh-menu`、`.dn`、`.menu-item`）的 `:focus-visible` SHALL 使用 `var(--accent)` 作為 focus ring 顏色，取代瀏覽器預設 outline。

```css
:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
}
```

#### Scenario: 鍵盤聚焦顯示 accent 色 focus ring

- **WHEN** 使用者以鍵盤（Tab 鍵）聚焦 `.sidebar-toggle` 按鈕
- **THEN** 按鈕 SHALL 顯示 `box-shadow: 0 0 0 2px var(--accent)` 的 focus ring，顏色為 `#8B8580`
