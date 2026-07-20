# CSS HIG 規則

此為唯一權威來源。`tp-hig`、`tp-code-verify`、`CLAUDE.md` 等均參照此文件。
由 `tests/unit/css-hig.test.js` 自動守護，commit 時 pre-commit hook 執行。

Design tokens 速查表見 `../tp-hig/references/tokens.md`。
頁面結構模式見 `../tp-hig/references/page-structure.md`。

---

## CSS HIG 規則（12 條）

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

### H7 chrome 材質（Regular Glass）
chrome（titlebar / 底部膠囊 / page bottom bar / sheet / stack header）的玻璃**一律吃材質
token**，禁止逐處自訂：
```css
background: var(--glass-tint);
backdrop-filter: var(--glass-filter);
-webkit-backdrop-filter: var(--glass-filter);
border: var(--glass-rim);
box-shadow: var(--glass-specular), var(--glass-shadow);
```

**禁止用品牌色染玻璃** —— `color-mix(in srgb, var(--color-background|secondary|accent) N%, transparent)`
當 chrome background 是違規。Apple HIG 明令「glass 不上 tint，顏色留給 content layer」；
奶油玻璃疊奶油頁必然 cream-on-cream 糊掉（2026-07-20 實證）。`--glass-tint` 是**中性**的，
底層顏色由 `saturate(180%)` 抽出來，不由我們填。

⚠ `--glass-tint` 的 alpha 由**最壞情況對比度**反推（膠囊可能浮在 satellite 圖磚上），
不是美感值。調低前先重算 WCAG AA 4.5:1。

已核可例外（不受本條約束，各自有測試守護）：
- `DesktopSidebar` — macOS vibrancy `blur(30px)`，DESIGN.md §10.3
- ExplorePage ≤32px 浮動小按鈕 — `blur(8px)`，14px 在小元素上會 over-soften 邊緣

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

---

## Dark Mode 規則

優先用 `var(--token)` 寫 base 樣式。若 base 樣式已使用 `var(--token)` 且該 token 在 `body.dark` 有覆寫，**不需額外寫 `body.dark .class` 規則**。僅在 dark mode 需要**不同屬性值**時才加覆寫。

---

## 新增頁面 Checklist

1. **HTML 檔案**：複製骨架（見 `../tp-hig/references/page-structure.md`），調整 CSP `connect-src`
2. **CSS 檔案**：`css/{page}.css`，第一行註解標明頁面名稱
3. **JS 檔案**：`js/{page}.js`，載入 `shared.js` + `icons.js`
4. **捲動基礎設施**：若頁面結構不同於行程頁（模式 A），須中和（見常見陷阱）
5. **Dark mode**：優先用 `var(--token)` 寫 base 樣式，讓 `body.dark` token 覆寫自動生效
6. **圖示**：全站 inline SVG（Material Symbols Rounded），不用 icon font
7. **無框線設計**：卡片和按鈕不加 `border`，用背景色區分層級
8. **註冊 CSS**：在 `tests/unit/css-hig.test.js` 的 `CSS_FILES` 物件加入新 CSS 檔案
9. **觸控目標**：互動元素最小 `44px`（`var(--tap-min)`）
10. **測試**：`npm test` 確認 HIG 規則全過

---

## 常見陷阱

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

**場景 A**：chrome 背景改成實色 `var(--bg)` 後，毛玻璃效果消失。
**解法**：用 `var(--glass-tint)` + `var(--glass-filter)`，不要自己寫值。

**場景 B（更常見，2026-07-20 實證）**：玻璃用了**品牌色** `color-mix(--color-background/secondary ...)`，
在同色相的頁面上看起來像一條實心色帶 —— 於是有人把 opacity 從 62% 調到 72%、88%⋯⋯ 全都沒用。
**根因不是數值，是 tint 的色相**。玻璃底跟頁面同色＝再疊一次同一個顏色。
**解法**：改中性 `--glass-tint`。它會讓底層內容的顏色透過 `saturate(180%)` 浮上表面，
而不是被品牌色蓋掉。

### 陷阱 3：dh-nav 手機溢出

**場景**：`.dh-nav` 在 base 樣式加 `justify-content: center`，手機寬度不足時左側內容被截斷。

**解法**：base 樣式不加 center，僅在 `@media (min-width: ...)` 內容夠寬時才置中。
