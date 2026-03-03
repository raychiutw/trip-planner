## MODIFIED Requirements

### Requirement: 設定頁面版面結構

setting.html 的主要內容區域 SHALL 使用與 edit.html 一致的版面骨架：桌機版內容限寬 `60vw` 居中，頁面背景為 body `--bg`。

#### Scenario: 桌機版內容限寬 60vw 居中

- **WHEN** viewport width ≥ 768px
- **THEN** `.setting-page` 最大寬度 SHALL 為 `60vw`，水平居中

#### Scenario: 頁面背景為 body --bg

- **WHEN** setting 頁面渲染完成
- **THEN** `.setting-page` SHALL 不自行設定背景色，讓 body `--bg` 透出

#### Scenario: color-mode-card active 使用 accent 色

- **WHEN** 使用者選擇一個色彩模式
- **THEN** 選中的 `.color-mode-card` 邊框色 SHALL 為 `var(--accent)`，不使用 `var(--blue)`
