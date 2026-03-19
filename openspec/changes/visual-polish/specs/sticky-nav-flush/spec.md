## MODIFIED Requirements

### Requirement: Day pills 靠右對齊

在行程頁面，`#navPills`（或 `.nav-pills`）容器 SHALL 套用 `margin-left: auto`，使 Day pills 靠 sticky-nav 右側排列，與行程名稱（brand）保持視覺呼吸距離。此調整 MUST NOT 影響 pills 溢出時的水平捲動機制（`overflow-x: auto`）。

> 注：本 Requirement 取代原 `sticky-nav-flush` spec 中的「桌面版 nav pills 視覺置中」Requirement（原 Requirement 定義桌面版 pills 置中；本版本調整為靠右，手機版與桌機版均適用）。

#### Scenario: Day pills 靠 nav 右側顯示

- **WHEN** 行程頁面載入，sticky-nav 渲染完成
- **THEN** `#navPills` 的 `margin-left` SHALL 為 `auto`，pills 靠 sticky-nav 右側

#### Scenario: pills 靠右不影響溢出捲動

- **WHEN** 行程天數多，pills 總寬度超出 `.dh-nav` 可見寬度
- **THEN** `.dh-nav` SHALL 仍可水平捲動，`margin-left: auto` 不干擾溢出捲動機制

#### Scenario: 手機版與桌機版均靠右

- **WHEN** 使用者在手機版（<768px）或桌機版（≥768px）檢視行程
- **THEN** Day pills SHALL 靠右對齊，不因視窗寬度不同而改變對齊方向
