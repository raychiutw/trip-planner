## ADDED Requirements

### Requirement: 選單展開時漢堡圖示變形為關閉圖示
當手機版側邊選單展開時（body 具有 menu-open class），sticky-nav 內的漢堡圖示 SHALL 平滑變形為 ✕ 關閉圖示。選單關閉時 SHALL 平滑恢復為漢堡圖示。

#### Scenario: 展開選單時漢堡變為 ✕
- **WHEN** 使用者點擊漢堡按鈕展開側邊選單
- **THEN** 漢堡圖示的三條線平滑動畫變形為 ✕：上線旋轉 45°、中線淡出、下線旋轉 -45°

#### Scenario: 關閉選單時 ✕ 恢復為漢堡
- **WHEN** 使用者關閉側邊選單（點擊 backdrop、點擊 ✕、或左滑）
- **THEN** ✕ 圖示平滑動畫恢復為三條線漢堡圖示
