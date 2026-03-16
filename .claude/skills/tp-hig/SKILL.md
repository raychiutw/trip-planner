---
name: tp-hig
description: Use when adding or modifying HTML/CSS in the trip-planner project to ensure compliance with Apple-inspired HIG design rules, tokens, and page structure patterns.
user-invocable: false
---

# 網頁 HIG 設計規範（Apple-inspired）

新增或修改 HTML/CSS 時的設計規範參考。由 `tests/unit/css-hig.test.js` 自動守護。

Design tokens 速查表見 `references/tokens.md`。頁面結構模式見 `references/page-structure.md`。

## CSS HIG 規則（12 條）

以下規則由 `tests/unit/css-hig.test.js` 自動檢測，commit 時 pre-commit hook 執行。

- **H1** font-size 僅允許 `var(--fs-*)`、`em`/`rem`/`%`，禁止硬編碼 px
- **H2** transition duration 僅允許 `var(--duration-*)`，例外 `0s`
- **H3/H4/H5** padding/margin/gap px 值必須為 4 的倍數
- **H6** 禁用 `#fff`，改用 `var(--text-on-accent)`。例外：`.g-icon`、`.n-icon`、`.cmp-`
- **H7** `.sticky-nav` 必須用 `color-mix(in srgb, var(--bg) 85%, transparent)` + `backdrop-filter`
- **H8** 設定頁 color mode preview 使用 `var(--cmp-*)` token
- **H9** `outline: none` 必須搭配 `box-shadow: var(--shadow-ring)`
- **H10** overlay 使用 `var(--overlay)` token
- **H11** `::before`/`::after` 遵守 4pt grid
- **H12** `.dh-nav` 基礎樣式禁止 `justify-content: center`

**Dark mode**：優先用 `var(--token)` 寫 base 樣式。僅在 dark mode 需要不同屬性值時才加 `body.dark` 覆寫。

## 新增頁面 checklist

1. HTML：複製骨架（見 `references/page-structure.md`），調整 CSP
2. CSS：`css/{page}.css`
3. JS：`js/{page}.js`，載入 `shared.js` + `icons.js`
4. 捲動基礎設施：結構不同於行程頁須中和（見常見陷阱）
5. Dark mode：用 `var(--token)` 寫 base 樣式
6. 圖示：全站 inline SVG（Material Symbols Rounded）
7. 無框線設計：用背景色區分層級
8. 註冊 CSS：`tests/unit/css-hig.test.js` 的 `CSS_FILES`
9. 觸控目標：最小 `44px`（`var(--tap-min)`）
10. 測試：`npm test`

## 常見陷阱

**Chrome 手機版捲動彈回**：新頁面須一次性中和 shared.css 捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`、`.container` transition、`.sticky-nav` sticky），單獨移除任一無效。解法見 `references/page-structure.md` 模式 C。

**frosted glass 失效**：永遠用 `color-mix` + `backdrop-filter`，不用實色。

**dh-nav 手機溢出**：base 不加 `justify-content: center`，僅 media query 內置中。
