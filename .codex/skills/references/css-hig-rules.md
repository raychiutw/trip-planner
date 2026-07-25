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

### 陷阱 1：（已移除 — 2026-07-25）

原內容講「中和 `shared.css` 捲動基礎設施」與 `html.page-{name}` 的多頁 class 慣例。**該架構已不存在**：`css/shared.css`、`.page-layout`、`.container`、`.sticky-nav` 全部隨多頁 HTML 一起消失，現在是 React SPA + 單一 `css/tokens.css`。整段刪除而非改寫 —— SPA 下的捲動問題是不同的問題，硬套舊解法會誤導。

⚠️ **捲動彈回在 SPA 下仍然存在，但成因與解法都不同**（現在是路由返回時的捲動還原與使用者意圖搶奪，不是 CSS 基礎設施衝突）。**這塊目前沒有文件擁有** —— `DESIGN.md` 零命中、`CONTEXT.md` 只提到 root tab 捲動時常駐。要改動捲動還原行為前，先查 git log 與既有 e2e（`tests/e2e/trip-stack-scroll-sheet.spec.js`），不要照本段舊解法做。

### 陷阱 2：frosted glass 失效

**場景**：`.sticky-nav` 背景改成實色 `var(--bg)` 後，毛玻璃效果消失。

**解法**：永遠用 `color-mix(in srgb, var(--bg) 85%, transparent)` + `backdrop-filter`。

### 陷阱 3：dh-nav 手機溢出

**場景**：`.dh-nav` 在 base 樣式加 `justify-content: center`，手機寬度不足時左側內容被截斷。

**解法**：base 樣式不加 center，僅在 `@media (min-width: ...)` 內容夠寬時才置中。
