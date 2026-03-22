## ADDED Requirements

### Requirement: Service Worker App Shell Precache
系統 SHALL 使用 Service Worker 預存所有靜態資源，離線也能載入網站。

#### Scenario: 離線載入網站
- **WHEN** 使用者在離線狀態打開已安裝 SW 的網站
- **THEN** HTML/CSS/JS SHALL 從 SW cache 載入，不顯示白頁

#### Scenario: SW 自動更新
- **WHEN** 網站部署新版本
- **THEN** SW SHALL 自動更新 precache（registerType: autoUpdate）

### Requirement: API GET 請求 NetworkFirst 快取
系統 SHALL 對 `/api/*` GET 請求使用 NetworkFirst 策略快取。

#### Scenario: 有網路時取最新資料
- **WHEN** 有網路且使用者瀏覽行程
- **THEN** SHALL 從 API 取最新資料 + 同時寫入快取

#### Scenario: 離線時從快取讀取
- **WHEN** 離線且快取中有該行程資料
- **THEN** SHALL 從快取讀取並正常顯示行程

#### Scenario: 離線且無快取
- **WHEN** 離線且快取中無該行程資料
- **THEN** SHALL 顯示離線錯誤提示（非白頁）

### Requirement: 離線狀態提示橫幅
系統 SHALL 在離線時顯示提示橫幅，上線時顯示恢復提示。

#### Scenario: 進入離線
- **WHEN** navigator.onLine 變為 false
- **THEN** StickyNav 下方 SHALL 顯示離線提示橫幅

#### Scenario: 恢復上線
- **WHEN** navigator.onLine 變為 true
- **THEN** 橫幅 SHALL 改顯示「已恢復連線」
- **THEN** 2 秒後 SHALL 淡出消失

### Requirement: 離線時編輯功能停用
系統 SHALL 在離線時停用所有編輯相關功能。

#### Scenario: 離線時 SpeedDial 停用
- **WHEN** 離線
- **THEN** SpeedDial/FAB SHALL 顯示 disabled 狀態（半透明 + 不可點擊）

#### Scenario: 離線時 QuickPanel 寫入項目停用
- **WHEN** 離線且開啟 QuickPanel
- **THEN** 寫入相關項目（改行程、送請求等）SHALL 顯示 disabled
