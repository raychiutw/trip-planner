## close-button-nav

edit.html 和 setting.html 使用 X 關閉鈕取代 sidebar/drawer 導航。

### Requirements

1. sticky-nav 右側顯示 X 關閉按鈕（`.nav-close-btn`）
2. X 按鈕使用 inline SVG close icon（Material Symbols Rounded 風格）
3. 點擊 X → `window.location.href = 'index.html'`（edit 頁帶 `?trip=<slug>` 參數）
4. 標題文字使用 `--fs-lg`、`font-weight: 700`，overflow ellipsis
5. 手機與桌機呈現一致（無 hamburger、無 sidebar）
6. `.nav-close-btn` hover 效果與 `.nav-action-btn` 一致（color accent、background accent-light）
