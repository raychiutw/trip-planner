## ADDED Requirements

### Requirement: Web App Manifest 支援 standalone 模式
系統 SHALL 提供 `manifest.json`，讓使用者加入主畫面後以 standalone 模式開啟（無瀏覽器 UI）。

#### Scenario: iOS Safari 加入主畫面
- **WHEN** 使用者在 iOS Safari 選擇「加入主畫面」
- **THEN** 主畫面 SHALL 出現 App icon（192x192 PNG）
- **THEN** 點擊 icon SHALL 以 standalone 模式開啟（無 URL bar）

#### Scenario: manifest 必要欄位
- **WHEN** 瀏覽器解析 manifest.json
- **THEN** SHALL 包含 name、short_name、start_url、display: standalone、icons

### Requirement: Apple PWA Meta Tags
所有 HTML 入口 SHALL 包含 Apple PWA 專用 meta tags。

#### Scenario: 4 個 HTML 入口都有 meta tags
- **WHEN** 載入 index.html、setting.html、manage/index.html、admin/index.html
- **THEN** 每個 SHALL 包含 apple-mobile-web-app-capable、apple-mobile-web-app-status-bar-style、apple-touch-icon

### Requirement: 動態 theme-color
系統 SHALL 在主題或 dark mode 切換時，動態更新 `<meta name="theme-color">` 的值為當前背景色。

#### Scenario: 切換到 dark mode
- **WHEN** 使用者切換到 dark mode
- **THEN** theme-color meta tag SHALL 更新為 dark mode 的背景色值

#### Scenario: 切換主題
- **WHEN** 使用者從 sun 切換到 zen 主題
- **THEN** theme-color meta tag SHALL 更新為 zen 主題的背景色值
