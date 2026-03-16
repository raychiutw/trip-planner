---
name: tp-hig
description: Use when adding or modifying HTML/CSS in the trip-planner project to ensure compliance with Apple-inspired HIG design rules, tokens, and page structure patterns.
user-invocable: false
---

# 網頁 HIG 設計規範（Apple-inspired）

新增或修改 HTML/CSS 時的設計規範參考。由 `tests/unit/css-hig.test.js` 自動守護。

---

## § 1 Design Tokens 速查表

所有 token 定義在 `css/shared.css :root`，dark mode 覆寫在 `body.dark`。

### Color

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--accent` | `#C4704F` | `#D4845E` | 主色 |
| `--accent-subtle` | `#F9F3EF` | `#252220` | 選取背景 |
| `--accent-bg` | `#F5EDE8` | `#3D2F27` | 卡片/按鈕背景 |
| `--bg` | `#FAF9F5` | `#1A1A1A` | 頁面底色 |
| `--bg-secondary` | `#F5F0E8` | `#2B2B2B` | section 卡片 |
| `--bg-tertiary` | `#F0EDE8` | `#3D3A35` | 深層底色 |
| `--hover-bg` | `#EDE8E0` | `#3D3A37` | hover 狀態 |
| `--text` | `#1A1A1A` | `#E8E8E8` | 主文字 |
| `--text-muted` | `#6B6B6B` | `#9B9B9B` | 次要文字 |
| `--text-on-accent` | `#FFFFFF` | `#FFFFFF` | accent 上的白字 |
| `--border` | `#E5E0DA` | `#3A3A3A` | 分隔線 |
| `--error` | `#D32F2F` | `#FCA5A5` | 錯誤 |
| `--error-bg` | `#FFEBEE` | `rgba(220,38,38,0.12)` | 錯誤背景 |
| `--success` | `#10B981` | `#6EE7B7` | 成功 |
| `--overlay` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.55)` | 遮罩 |

### Typography（11 級 Apple text style）

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

### Spacing（4pt grid）

所有 margin / padding / gap 的 px 值必須為 **4 的倍數**（0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48 ...）。

| Token | 值 | 用途 |
|-------|----|------|
| `--padding-h` | `16px`（≥768px: `20px`） | 水平內距 |
| `--nav-h` | `48px` | 導航列高 |
| `--content-max-w` | `720px` | 內容最大寬 |
| `--info-panel-w` | `280px` | 桌機側欄寬 |
| `--tap-min` | `44px` | 最小觸控目標 |

### Radius（5 級）

| Token | 值 |
|-------|----|
| `--radius-xs` | `4px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-full` | `99px` |

### Motion（3 級）

| Token | 值 |
|-------|----|
| `--duration-fast` | `150ms` |
| `--duration-normal` | `250ms` |
| `--duration-slow` | `350ms` |
| `--ease-apple` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

### Shadow

| Token | 值 |
|-------|----|
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` |
| `--shadow-lg` | `0 6px 16px rgba(0,0,0,0.2)` |
| `--shadow-ring` | `0 0 0 2px var(--accent)` |

---

## § 2 CSS HIG 規則（12 條）

以下規則由 `tests/unit/css-hig.test.js` 自動檢測，commit 時 pre-commit hook 執行。

### H1 font-size token 限定
`font-size` 僅允許 `var(--fs-*)` 系列 token、`em`/`rem`/`%`、`inherit`/`initial`/`unset`。禁止硬編碼 px 值。

### H2 transition duration token 限定
transition 的時間值僅允許 `var(--duration-fast/normal/slow)`。禁止硬編碼 `0.2s`、`150ms` 等。例外：`0s`（instant）允許。

### H3 4pt grid — padding
padding 系列屬性的 px 值必須為 4 的倍數。`var()` 和 `calc()` 跳過檢查。

### H4 4pt grid — margin
margin 系列屬性的 px 值必須為 4 的倍數。同上例外。

### H5 4pt grid — gap
gap / row-gap / column-gap 的 px 值必須為 4 的倍數。同上例外。

### H6 #fff 禁令
`color: #fff` / `#FFF` / `#ffffff` 改用 `var(--text-on-accent)`。例外：`.g-icon`、`.n-icon`、`.cmp-` 品牌選擇器。

### H7 frosted glass nav
`.sticky-nav` 的 background 禁止用實色 `var(--bg)` 或 `rgba()`。必須用：
```css
background: color-mix(in srgb, var(--bg) 85%, transparent);
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
```

### H8 color mode preview token
設定頁的 `.color-mode-light` / `.color-mode-dark` / `.color-mode-auto` 使用 `var(--cmp-*)` token，禁止硬編碼色碼。

### H9 focus-visible
`outline: none` 必須搭配 `box-shadow: var(--shadow-ring)`。例外：表單輸入（`textarea`、`input`、`.edit-textarea`）用文字游標顯示焦點。

### H10 overlay/backdrop
backdrop/overlay 選擇器使用 `var(--overlay)` token，禁止硬編碼 `rgba(0,0,0,...)`。

### H11 pseudo-element spacing
`::before` / `::after` 的 margin/padding 同樣遵守 4pt grid。例外：`.ov-card h4::before`、`.cmp-`、scrollbar。

### H12 dh-nav 禁止 center
`.dh-nav` 基礎樣式禁止 `justify-content: center`（會造成手機 overflow-x 左側截斷）。

### Dark mode 規則
若 base 樣式已使用 `var(--token)` 且該 token 在 `body.dark` 有覆寫，不需額外寫 `body.dark .class` 規則。僅在 dark mode 需要**不同屬性值**時才加覆寫。

---

## § 3 頁面結構模式

### 共用骨架

所有頁面共用：
- **CSS**：`shared.css`（必載，第一個）+ 頁面專屬 CSS
- **JS**：`shared.js`（dark mode、tripId 管理）+ `icons.js`（SVG 圖示）+ 頁面專屬 JS
- **HTML `<head>`**：charset → viewport（含 `viewport-fit=cover`）→ CSP → theme-color → favicon → title → CSS

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta http-equiv="Content-Security-Policy" content="...">
    <meta name="theme-color" content="#C4704F">
    <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="images/favicon-32x32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="images/apple-touch-icon.png">
    <title>頁面名稱 — Trip Planner</title>
    <link rel="stylesheet" href="css/shared.css">
    <link rel="stylesheet" href="css/{page}.css">
</head>
<body>
    <div class="page-layout">
        <div class="container">
            <div class="sticky-nav">...</div>
            <main>...</main>
        </div>
    </div>
    <script src="js/shared.js"></script>
    <script src="js/icons.js"></script>
    <script src="js/{page}.js"></script>
</body>
</html>
```

### 模式 A：行程頁（index.html）

- `.sticky-nav` 在 `.page-layout` 外層（因為有桌機側欄 `.info-panel`）
- `.container` + `aside.info-panel` 並排於 `.page-layout` 內
- 使用 shared.css 的捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`）
- 無需額外中和

### 模式 B：子頁面（edit.html）

- `.sticky-nav` 在 `.container` 內部
- 使用 `.nav-title` + `.nav-close-btn` 標準組合
- 沿用 shared.css 捲動基礎設施

### 模式 C：簡單頁面（setting.html）

- 在 `<html>` 和 `<body>` 加 `class="page-setting"`
- **必須中和 shared.css 捲動基礎設施**（見 § 5 陷阱 1）
- `.sticky-nav` 在 `.container` 內部
- 使用 `.nav-title` + `.nav-close-btn` 標準組合

---

## § 4 新增頁面 checklist

1. **HTML 檔案**：複製 § 3 骨架，調整 CSP `connect-src`
2. **CSS 檔案**：`css/{page}.css`，第一行註解標明頁面名稱
3. **JS 檔案**：`js/{page}.js`，載入 `shared.js` + `icons.js`
4. **捲動基礎設施**：若頁面結構不同於行程頁（模式 A），須中和（見 § 5）
5. **Dark mode**：優先用 `var(--token)` 寫 base 樣式，讓 `body.dark` token 覆寫自動生效
6. **圖示**：全站 inline SVG（Material Symbols Rounded），不用 icon font
7. **無框線設計**：卡片和按鈕不加 `border`，用背景色區分層級
8. **註冊 CSS**：在 `tests/unit/css-hig.test.js` 的 `CSS_FILES` 物件加入新 CSS 檔案
9. **觸控目標**：互動元素最小 `44px`（`var(--tap-min)`）
10. **測試**：`npm test` 確認 HIG 規則全過

---

## § 5 常見陷阱

### 陷阱 1：Chrome 手機版捲動彈回

**場景**：新頁面結構與行程頁差異大時，Chrome 手機版捲到底部會彈回頂部。

**根因**：`shared.css` 的捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`、`.container` 的 `transition: transform`、`.sticky-nav` 的 `position: sticky`）為行程頁設計。必須**全部中和**，單獨移除任一無效。

**解法**（頁面專屬 CSS 開頭）：
```css
html.page-{name} {
    scroll-behavior: auto;
    scrollbar-gutter: auto;
    overflow: visible;
    overscroll-behavior: none;
}
.page-{name} {
    max-width: none;
    overflow: visible;
}
.page-{name} .page-layout {
    display: block;
    min-height: 0;
}
.page-{name} .container {
    transition: none;
}
.page-{name} .sticky-nav {
    position: sticky;
    top: 0;
    z-index: 200;
}
```

同時在 HTML 加上 `<html class="page-{name}">` 和 `<body class="page-{name}">`。

### 陷阱 2：frosted glass 失效

**場景**：`.sticky-nav` 背景改成實色 `var(--bg)` 後，毛玻璃效果消失。

**解法**：永遠用 `color-mix(in srgb, var(--bg) 85%, transparent)` + `backdrop-filter`。

### 陷阱 3：dh-nav 手機溢出

**場景**：`.dh-nav` 在 base 樣式加 `justify-content: center`，手機寬度不足時左側內容被截斷。

**解法**：base 樣式不加 center，僅在 `@media (min-width: ...)` 內容夠寬時才置中。
