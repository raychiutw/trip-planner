## accent-lighter-color

新增 `--accent-lighter` CSS 變數，用於概況區（`.day-overview`）底色，與子元件 `--accent-light` 拉開視覺層次。

### Requirements

1. 在 `:root` 新增 `--accent-lighter: #F9F3EF`
2. 在 `body.dark` 新增 `--accent-lighter: #252220`
3. `.day-overview` 的 `background` 從 `var(--accent-light)` 改為 `var(--accent-lighter)`
4. 列印模式和 `@media print` 中同步定義 `--accent-lighter`
5. 色階維持：`--bg` → `--accent-lighter` → `--accent-light` → `--accent`
