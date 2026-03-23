## ADDED Requirements

### Requirement: StickyNav 毛玻璃效果
StickyNav SHALL 降低背景不透明度並增強 blur，讓底層內容透出模糊色彩。

#### Scenario: 捲動時透出內容
- **WHEN** 使用者捲動頁面
- **THEN** StickyNav 下方的內容 SHALL 透出模糊的色彩（非純色遮蓋）

### Requirement: Sheet Panel 毛玻璃效果
InfoSheet 和 QuickPanel 的 panel SHALL 有 backdrop-filter blur 效果。

#### Scenario: InfoSheet 開啟
- **WHEN** InfoSheet 開啟
- **THEN** panel 背後的內容 SHALL 透出模糊效果
- **THEN** 不支援 backdrop-filter 的瀏覽器 SHALL fallback 到純色背景（不影響使用）
