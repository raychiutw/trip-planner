## MODIFIED Requirements

### Requirement: switchDay 捲動須扣除 sticky-nav 高度

`switchDay()` 捲動到目標 Day 時 SHALL 扣除 sticky-nav 的高度，確保 day-header 不被遮住。

#### Scenario: 點擊 Day 3 pill 後 header 可見

- **WHEN** 使用者點擊 Day 3 nav pill
- **THEN** `#day3` 的 `boundingBox().y` SHALL >= `#stickyNav` 的底部座標（y + height）

#### Scenario: URL hash 正確設定

- **WHEN** 使用者點擊 Day 3 nav pill
- **THEN** URL hash SHALL 為 `#day3`

---

### Requirement: nav pills 基礎排列為 flex-start

`.dh-nav` 基礎樣式 SHALL 使用 `justify-content: flex-start`（或省略，因 flex 預設即為 flex-start），確保手機版溢出時所有 pills 可透過捲動到達。

桌機版（`min-width: 768px`）MAY 使用 `justify-content: center`。

#### Scenario: 手機版 Day 1 pill 在視窗內

- **WHEN** 使用 375px 寬度手機視窗載入頁面
- **THEN** Day 1 pill 的 `boundingBox().x` SHALL >= 0

#### Scenario: 桌機版 pills 居中

- **WHEN** 使用 1200px+ 寬度桌機視窗載入頁面
- **THEN** nav pills 排列 SHALL 為居中（`justify-content: center`）
