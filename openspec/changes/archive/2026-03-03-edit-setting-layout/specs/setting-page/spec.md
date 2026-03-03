## MODIFIED Requirements

### Requirement: Setting 頁面桌機版 Layout 留白與寬度

桌機版（viewport width ≥ 768px）的 `.setting-page` SHALL 提供充裕頂部留白（`padding-top: 48px`）與較寬的最大內容寬度（`max-width: 640px`），讓頁面風格接近 Claude 的內容頁佈局。行動版 padding 維持 `16px`，不加頂部留白。

#### Scenario: 桌機版頂部留白

- **WHEN** viewport width ≥ 768px 且開啟 setting.html
- **THEN** `.setting-page` 頂部 padding SHALL 為 `48px`，內容不緊貼 viewport 頂端

#### Scenario: 桌機版最大寬度

- **WHEN** viewport width ≥ 768px 且開啟 setting.html
- **THEN** `.setting-page` 的 `max-width` SHALL 為 `640px`，水平置中（`margin: 0 auto`）

#### Scenario: 行動版不受影響

- **WHEN** viewport width < 768px 且開啟 setting.html
- **THEN** `.setting-page` 的頂部留白 SHALL 維持原有 `16px`（整體 padding），最大寬度不受限制
