## MODIFIED Requirements

### Requirement: 到達旗標顯示時間範圍

`renderTimelineEvent()` 的到達旗標（`.tl-flag-arrive`）SHALL 同時顯示到達與離開時間。若 `parsed.end` 存在，旗標 MUST 顯示格式為 `<start>-<end>`（如 `16:30-18:30`）。若無離開時間，MUST 僅顯示到達時間。

#### Scenario: 有離開時間的事件
- **WHEN** timeline 事件的 time 欄位包含結束時間（如 `16:30-18:30`）
- **THEN** 到達旗標顯示 `① 16:30-18:30`，不產生獨立的離開旗標

#### Scenario: 無離開時間的事件
- **WHEN** timeline 事件的 time 欄位僅有開始時間（如 `16:30`）
- **THEN** 到達旗標顯示 `① 16:30`，與現行行為一致

## REMOVED Requirements

### Requirement: 獨立離開旗標
**Reason**: 離開時間已併入到達旗標，不再需要獨立的 `.tl-flag-depart` 元素
**Migration**: 到達旗標自動顯示時間範圍，無需額外處理

### Requirement: Transit 方向箭頭
**Reason**: `.tl-transit-arrow`（→ 圖示）為純裝飾元素，無互動功能，移除以簡化 UI
**Migration**: 移除 JS render 與 CSS 樣式，無資料格式變動
