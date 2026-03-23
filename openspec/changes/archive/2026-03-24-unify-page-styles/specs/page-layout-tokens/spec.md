## page-layout-tokens

### 需求

1. `--page-max-w` token 定義在 `shared.css` `:root`，值為 `min(60vw, 900px)`
2. `--page-pt` token 定義在 `shared.css` `:root`，值為 `var(--spacing-6)`
3. `.page-simple` class 包含捲動重置（html 級別）+ page-layout block + container transition none
4. `.sticky-nav` base 樣式在 `shared.css` 定義：sticky + border-bottom + backdrop-filter
5. 所有非行程頁（setting/admin/manage/edit）的 max-width 使用 `var(--page-max-w)`
6. 所有頁面的 nav 標題置中
7. 非行程頁 desktop padding-top 統一使用 `var(--page-pt)`

### 驗收條件

- [ ] `css/shared.css` 有 `--page-max-w` 和 `--page-pt` token
- [ ] `css/shared.css` 有 `.page-simple` class（含捲動重置）
- [ ] `css/shared.css` 有統一的 `.sticky-nav` base（含 backdrop-filter）
- [ ] `css/setting.css` 不再有獨立的捲動重置和 `.sticky-nav` 定義
- [ ] `css/admin.css` 不再有獨立的捲動重置和 `.sticky-nav` 定義
- [ ] `css/manage.css` 不再有獨立的 `.sticky-nav` 定義
- [ ] `css/edit.css` 不再有獨立的 `.sticky-nav` 定義
- [ ] 四個頁面視覺效果不變（只是 code 統一）
- [ ] `npx tsc --noEmit` + `npm test` 全過
