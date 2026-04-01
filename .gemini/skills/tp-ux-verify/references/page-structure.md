# 頁面結構模式

## 共用骨架

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

## 模式 A：行程頁（index.html）

- `.sticky-nav` 在 `.page-layout` 外層（因為有桌機側欄 `.info-panel`）
- `.container` + `aside.info-panel` 並排於 `.page-layout` 內
- 使用 shared.css 的捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`）
- 無需額外中和

## 模式 B：子頁面（edit.html）

- `.sticky-nav` 在 `.container` 內部
- 使用 `.nav-title` + `.nav-close-btn` 標準組合
- 沿用 shared.css 捲動基礎設施

## 模式 C：簡單頁面（setting.html）

- 在 `<html>` 和 `<body>` 加 `class="page-setting"`
- **必須中和 shared.css 捲動基礎設施**（見常見陷阱）
- `.sticky-nav` 在 `.container` 內部
- 使用 `.nav-title` + `.nav-close-btn` 標準組合
