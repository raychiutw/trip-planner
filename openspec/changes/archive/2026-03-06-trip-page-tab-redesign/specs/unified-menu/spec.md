## MODIFIED Requirements

### Requirement: 選單區段二（僅 index.html）

**變更**：index.html 不再使用 sidebar/drawer 選單。原功能跳轉項目（航班/清單/備案/緊急/建議）改由 Speed Dial FAB 承載。列印模式改由 sticky-nav 右側按鈕觸發。

index.html 的 `buildMenu()` SHALL 不再渲染 `#menuGrid`（drawer）和 `#sidebarNav`（sidebar）內容。

#### Scenario: index.html 無 sidebar/drawer 選單內容

- **WHEN** index.html 載入完成
- **THEN** `#menuGrid` 和 `#sidebarNav` SHALL 為空或不存在

## REMOVED Requirements

### Requirement: Sidebar（桌機 ≥768px）左側固定（僅 index.html）

**Reason**: index.html 的 sidebar 功能已被 tab pills + speed dial + nav action icons 完全取代
**Migration**: 天數導航由 nav pills tab 切換；功能跳轉由 Speed Dial FAB；列印/設定由 sticky-nav 右側 icon

### Requirement: Drawer（手機 <768px）從左側滑入（僅 index.html）

**Reason**: index.html 的 drawer 功能已被 tab pills + speed dial + nav action icons 完全取代
**Migration**: 同上。edit/setting 頁的 drawer 不受影響。
