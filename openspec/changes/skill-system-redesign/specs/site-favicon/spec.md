## ADDED Requirements

### Requirement: 網站 Favicon

網站 SHALL 具有 favicon，在瀏覽器 tab、書籤、主畫面捷徑等場景顯示品牌 icon。設計為地圖 Pin 造型內嵌 TP 文字，配色使用 `#C4704F` 陶土色背景與白色文字。

#### Scenario: 瀏覽器 tab 顯示 favicon

- **WHEN** 使用者在瀏覽器開啟任一頁面（index.html、edit.html、setting.html）
- **THEN** 瀏覽器 tab SHALL 顯示地圖 Pin + TP 造型的 favicon

#### Scenario: SVG 為主要 favicon

- **WHEN** 瀏覽器支援 SVG favicon
- **THEN** SHALL 使用 `images/favicon.svg`（向量格式，任意縮放不失真）

#### Scenario: PNG fallback

- **WHEN** 瀏覽器不支援 SVG favicon
- **THEN** SHALL fallback 到 `images/favicon-32x32.png`（32×32 PNG）

#### Scenario: iOS 主畫面 icon

- **WHEN** iOS 使用者將網站加入主畫面
- **THEN** SHALL 使用 `images/apple-touch-icon.png`（180×180 PNG）

### Requirement: Favicon 檔案套件

`images/` 目錄 SHALL 包含完整的 icon 檔案套件。

#### Scenario: 必要檔案清單

- **WHEN** 檢查 `images/` 目錄
- **THEN** SHALL 包含以下檔案：
  - `favicon.svg`（SVG 向量）
  - `favicon-32x32.png`（32×32）
  - `favicon-16x16.png`（16×16）
  - `apple-touch-icon.png`（180×180）
  - `icon-192.png`（192×192，PWA/Android 用）
  - `icon-512.png`（512×512，PWA splash 用）

#### Scenario: 設計規格

- **WHEN** 產生 favicon 圖檔
- **THEN** 造型 SHALL 為地圖 Pin（水滴倒置形狀），Pin 頭內嵌 **TP** 粗體白色文字
- **AND** 背景填色 SHALL 為 `#C4704F`
- **AND** 文字顏色 SHALL 為 `#FFFFFF`

### Requirement: HTML link 標籤

三頁 HTML 的 `<head>` SHALL 包含 favicon 相關的 link 標籤。

#### Scenario: index.html favicon link

- **WHEN** 檢查 `index.html` 的 `<head>`
- **THEN** SHALL 包含：
  - `<link rel="icon" href="images/favicon.svg" type="image/svg+xml">`
  - `<link rel="icon" href="images/favicon-32x32.png" sizes="32x32" type="image/png">`
  - `<link rel="apple-touch-icon" href="images/apple-touch-icon.png">`

#### Scenario: edit.html favicon link

- **WHEN** 檢查 `edit.html` 的 `<head>`
- **THEN** SHALL 包含相同的三個 favicon link 標籤

#### Scenario: setting.html favicon link

- **WHEN** 檢查 `setting.html` 的 `<head>`
- **THEN** SHALL 包含相同的三個 favicon link 標籤
