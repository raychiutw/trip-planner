## MODIFIED Requirements

### Requirement: Day 按鈕等寬

`.dn` 按鈕 SHALL 顯示純數字標籤（"1" "2" "3"），不含 "D" 前綴。按鈕 SHALL 具備統一的最小寬度，確保天數標籤字元數不同（1 vs 10 vs 13）時按鈕外觀一致。

#### Scenario: 單字元天數標籤

- **WHEN** 顯示 1～9 等單字元天數按鈕
- **THEN** 按鈕顯示 "1"～"9"（無 "D" 前綴），寬度 SHALL ≥ 36px，文字水平置中

#### Scenario: 雙字元天數標籤

- **WHEN** 顯示 10 以上等雙字元天數按鈕
- **THEN** 按鈕顯示 "10" 以上（無 "D" 前綴），寬度 SHALL ≥ 36px

## ADDED Requirements

### Requirement: 桌機版 "Trip Planner" 品牌文字

桌機版（≥768px）sticky-nav SHALL 在 pills 左方顯示 "Trip Planner" 文字，字體為 `var(--fs-md)`、font-weight 700。

#### Scenario: 桌機版顯示品牌文字

- **WHEN** 使用者在 ≥768px 寬度裝置開啟行程頁
- **THEN** sticky-nav 左側顯示 "Trip Planner" 文字，右方緊接 pill 數字按鈕

#### Scenario: 手機版不顯示品牌文字

- **WHEN** 使用者在 <768px 寬度裝置開啟行程頁
- **THEN** sticky-nav 不顯示 "Trip Planner" 文字（`display: none`）

### Requirement: Pills 點擊切換 tab

nav pills 點擊行為 SHALL 從 anchor scroll 改為 tab 切換。點擊 pill 時 SHALL 切換對應天數的 `.day-section` 顯示，不進行頁面捲動。

#### Scenario: 點擊 pill 切換 tab 而非捲動

- **WHEN** 使用者點擊 pill "2"
- **THEN** 顯示第 2 天的 section，不發生頁面捲動
- **AND** pill "2" 獲得 `.active` class
