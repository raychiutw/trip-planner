## ADDED Requirements

### Requirement: Timeline 卡片半透明化（淺色模式）
系統 SHALL 在淺色模式下，將 `#tripContent section` 的背景色改為 `rgba(255, 255, 255, 0.92)`，並套用 `backdrop-filter: blur(6px)` 與 `-webkit-backdrop-filter: blur(6px)`（Safari 前綴），讓 SVG 背景插畫適度透出。

文字對比度 SHALL 維持合規：主要文字（`--text`）在 `rgba(255,255,255,0.92)` 背景上的對比度 SHALL 大於 4.5:1（WCAG AA）。

#### Scenario: 淺色模式卡片呈現半透明效果
- **WHEN** 頁面為淺色模式且 SVG 背景插畫已載入
- **THEN** `#tripContent section` 背景 SHALL 以 `rgba(255,255,255,0.92)` 渲染，背景插畫 SHALL 透過卡片輕微可見

#### Scenario: Safari 前綴生效
- **WHEN** 使用 Safari 瀏覽器開啟行程頁（淺色模式）
- **THEN** `-webkit-backdrop-filter: blur(6px)` SHALL 生效，卡片呈現模糊透明效果

#### Scenario: backdrop-filter 不支援時優雅退化
- **WHEN** 使用不支援 `backdrop-filter` 的瀏覽器
- **THEN** 卡片 SHALL 顯示為 `rgba(255,255,255,0.92)` 純色背景（輕微透明但無模糊），不得出現版面破損

### Requirement: Timeline 卡片半透明化（深色模式）
系統 SHALL 在深色模式（`body.dark`）下，將 `#tripContent section` 的背景色改為 `rgba` 形式的深色背景（對應 `--bg-secondary`，alpha 值 0.92），並同樣套用 `backdrop-filter: blur(6px)`，讓深色 SVG 背景插畫透出。

#### Scenario: 深色模式卡片呈現半透明效果
- **WHEN** 頁面為深色模式且深色 SVG 背景插畫已載入
- **THEN** `body.dark #tripContent section` 背景 SHALL 為 `rgba` 深色值（alpha 0.92），背景插畫 SHALL 透過卡片輕微可見

#### Scenario: 深色模式文字對比度合規
- **WHEN** 頁面為深色模式且卡片半透明
- **THEN** 主要文字顏色（`var(--text)`）在半透明深色背景上的對比度 SHALL 大於 4.5:1

### Requirement: info-card 同步半透明化
系統 SHALL 將 `.info-card`（InfoPanel 使用的子卡片）套用與 timeline 卡片一致的透明度規則（同一 CSS 規則合併或個別定義），確保視覺風格統一。

#### Scenario: info-card 與 timeline 卡片透明度一致
- **WHEN** 桌面版右側 InfoPanel 中的 `.info-card` 渲染於淺色模式
- **THEN** `.info-card` 背景 SHALL 為 `rgba(255,255,255,0.92)` + blur，與 timeline 卡片視覺一致

### Requirement: 列印模式下卡片還原不透明
系統 SHALL 在列印模式下移除半透明效果，確保列印輸出清晰。

```css
.print-mode #tripContent section,
.print-mode .info-card {
  background: var(--card-bg) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

#### Scenario: 列印模式卡片為不透明背景
- **WHEN** 使用者啟動列印模式
- **THEN** `#tripContent section` 與 `.info-card` 背景 SHALL 還原為 `var(--card-bg)`，無半透明或模糊效果
