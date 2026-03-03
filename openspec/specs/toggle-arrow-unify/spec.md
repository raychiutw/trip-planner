## MODIFIED Requirements

### Requirement: 展開箭頭統一使用全形字元

所有折疊/展開箭頭 SHALL 使用全形字元 `＋`（U+FF0B）和 `－`（U+FF0D）。

- `renderHourly` 生成的 `.hw-summary-arrow` 初始字元 SHALL 為 `＋`（全形）
- `toggleHw` 切換時 `.hw-summary-arrow` 的 textContent SHALL 在展開時設為 `－`，收合時設為 `＋`（皆為全形）
- 行程卡片（hotel、transit、budget）使用的 `.col-row .arrow` 已為全形，SHALL 保持不變

### Requirement: hw-summary-arrow 視覺對齊 col-row .arrow

`.hw-summary-arrow` SHALL 在視覺上與 `.col-row .arrow` 一致：

- `font-size` SHALL 為 `var(--fs-md)`
- `color` SHALL 為 `var(--gray)`
- `margin-left: auto` 保留（已存在），確保箭頭靠右對齊

#### Scenario: 天氣摘要箭頭初始狀態

- **WHEN** 天氣資料載入後渲染 `.hw-summary`
- **THEN** `.hw-summary-arrow` 的文字內容 SHALL 為 `＋`（全形加號）

#### Scenario: 天氣展開後箭頭切換

- **WHEN** 使用者點擊 `.hw-summary` 展開天氣詳情
- **THEN** `.hw-summary-arrow` 的文字內容 SHALL 變為 `－`（全形減號）

#### Scenario: 天氣收合後箭頭還原

- **WHEN** 使用者再次點擊 `.hw-summary` 收合天氣詳情
- **THEN** `.hw-summary-arrow` 的文字內容 SHALL 還原為 `＋`（全形加號）

#### Scenario: 箭頭字型大小一致

- **WHEN** 頁面渲染 `.hw-summary-arrow` 及 `.col-row .arrow`
- **THEN** 兩者的 computed font-size SHALL 相同（皆為 `var(--fs-md)` 解析值）
- **AND** 兩者的 computed color SHALL 相同（皆為 `var(--gray)` 解析值）
