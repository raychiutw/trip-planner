## ADDED Requirements

### Requirement: 列印模式卡片與 info-card 純白背景

系統 SHALL 在 `css/style.css` 中新增以下規則，確保 `.print-mode` 下 `.tl-card` 與 `.info-card` 均使用純白背景並移除毛玻璃效果：

```css
.print-mode .tl-card,
.print-mode .info-card {
  background: #FFFFFF;
  border: 1px solid #E0E0E0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

#### Scenario: 列印模式 tl-card 使用純白背景

- **WHEN** body 含有 `.print-mode` class 且頁面渲染 `.tl-card`
- **THEN** `.tl-card` 的 `background` SHALL 解析為 `#FFFFFF`，`backdrop-filter` SHALL 為 `none`

#### Scenario: 列印模式 info-card 使用純白背景

- **WHEN** body 含有 `.print-mode` class 且頁面渲染 `.info-card`
- **THEN** `.info-card` 的 `background` SHALL 解析為 `#FFFFFF`，`backdrop-filter` SHALL 為 `none`

#### Scenario: 列印模式卡片有邊線

- **WHEN** body 含有 `.print-mode` class 且頁面渲染 `.tl-card` 或 `.info-card`
- **THEN** 元素 SHALL 有 `border: 1px solid #E0E0E0`，確保列印時卡片邊界清晰

### Requirement: 列印模式 day-header 純白背景

系統 SHALL 在 `css/style.css` 中新增以下規則，確保 `.print-mode` 下 `.day-header` 使用純白背景與下邊線：

```css
.print-mode .day-header {
  background: #FFFFFF;
  border-bottom: 1px solid #E0E0E0;
}
```

#### Scenario: 列印模式 day-header 使用純白背景

- **WHEN** body 含有 `.print-mode` class 且頁面渲染 `.day-header`
- **THEN** `.day-header` 的 `background` SHALL 解析為 `#FFFFFF`，有 `border-bottom: 1px solid #E0E0E0`

### Requirement: @media print 純白規則

系統 SHALL 在 `css/style.css` 的 `@media print` 區塊中新增以下規則，確保瀏覽器原生列印輸出亦為純白：

```css
@media print {
  .tl-card,
  .info-card {
    background: #FFFFFF !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .day-header {
    background: #FFFFFF !important;
    border-bottom: 1px solid #E0E0E0 !important;
  }
}
```

#### Scenario: 瀏覽器列印時卡片為純白

- **WHEN** 使用者透過瀏覽器列印功能（Ctrl+P / window.print()）
- **THEN** `.tl-card` 與 `.info-card` 的 `background` SHALL 為 `#FFFFFF`，`backdrop-filter` SHALL 為 `none`

#### Scenario: 瀏覽器列印時 day-header 為純白

- **WHEN** 使用者透過瀏覽器列印功能
- **THEN** `.day-header` 的 `background` SHALL 為 `#FFFFFF`，有底部邊線
