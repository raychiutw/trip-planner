## 概覽

統一四個頁面的 CSS 風格，透過共用 token 和 class 減少重複 code。

## 設計決策

### 1. Layout Token

在 `shared.css` 的 `:root` 加入：

```css
--page-max-w: min(60vw, 900px);   /* 非行程頁的通用 max-width */
--page-pt: var(--spacing-6);       /* 非行程頁 desktop padding-top: 24px */
```

行程頁保持 `--content-max-w: 720px`（因為有側欄 info-panel 佈局）。

**重要**：`--page-max-w` 僅在 `@media (min-width: 768px)` 內套用。手機版維持全寬（無 max-width）。

### 2. `.page-simple` 共用 class

setting/admin 頁面共用的捲動重置抽成一個 class：

```css
html.page-simple {
    scroll-behavior: auto;
    scrollbar-gutter: auto;
    overflow: visible;
    overscroll-behavior: none;
}
.page-simple { max-width: none; overflow: visible; }
.page-simple .page-layout { display: block; min-height: 0; }
.page-simple .container { transition: none; }
.page-simple .sticky-nav { position: relative; }
```

setting.css 和 admin.css 移除各自的重置 code。

**注意**：`.page-simple .sticky-nav` 加入 `position: relative`（覆蓋 shared base 的 sticky），因為 admin 頁內容短不需要 sticky nav。

### 3. Sticky-nav 統一

**Base（shared.css）**：所有頁面共用

```css
.sticky-nav {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky-nav);
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-background) 92%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
```

**行程頁（style.css）**：加上 DestinationArt、padding override 等特殊效果。
**其他頁面**：移除各自的 `.sticky-nav` 重複定義，繼承 shared。

### 3.5. 深色模式 Sticky-nav

**Base（shared.css）**：所有頁面共用深色 nav 邊框

```css
body.dark .sticky-nav {
    border-bottom-color: color-mix(in srgb, var(--color-muted) 25%, transparent);
}
```

**行程頁（style.css）**：保留特殊的 accent-foreground 色覆寫（配合 DestinationArt）。

### 4. Nav 標題

統一**置中**（所有頁面）。左側用 `::before` 佔位保持對稱。

### 5. 頁面 max-width 對照

| 頁面 | 之前 | 之後 |
|------|------|------|
| 行程頁 | `720px` | `720px`（不變，有側欄） |
| 設定頁 | `520px` / `min(60vw, 900px)` | `var(--page-max-w)` |
| 管理頁 | `min(60vw, 900px)` | `var(--page-max-w)` |
| Admin 頁 | `600px` | `var(--page-max-w)` |

## 檔案變更

| 檔案 | 動作 |
|------|------|
| `css/shared.css` | 加 `--page-max-w` + `--page-pt` token、`.page-simple` class、統一 `.sticky-nav` base |
| `css/setting.css` | 移除 7 行捲動重置 + sticky-nav 重複、改用 `var(--page-max-w)` |
| `css/admin.css` | 移除 5 行捲動重置 + sticky-nav 重複、改用 `var(--page-max-w)` |
| `css/manage.css` | sticky-nav 改繼承 shared、max-width 改用 `var(--page-max-w)` |
| `css/style.css` | sticky-nav base 移到 shared，保留行程頁特殊效果 override |
| `src/pages/SettingPage.tsx` | html class 改用 `page-simple` |
| `src/pages/AdminPage.tsx` | html class 改用 `page-simple` |
| `css/edit.css` | sticky-nav 重複定義移除 |
