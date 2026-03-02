## ADDED Requirements

### Requirement: 系統訊息左對齊顯示
系統訊息（包含問候語）SHALL 以左對齊氣泡卡片方式呈現，帶有 Spark icon，最大寬度 80%。

#### Scenario: 問候語顯示為系統訊息
- **WHEN** edit 頁面載入完成
- **THEN** 問候語（早安/午安/晚安 + 副標「有什麼行程修改需求？」）顯示為左對齊卡片，含 Spark icon，寬度不超過訊息區域的 80%

#### Scenario: 系統訊息不在右側出現
- **WHEN** 渲染系統訊息卡片
- **THEN** 卡片對齊訊息區域左側，右側留有空白

### Requirement: 使用者訊息右對齊氣泡
使用者送出的 GitHub Issues SHALL 以右對齊氣泡呈現，末尾附帶 open/closed 狀態標記，最大寬度 80%。

#### Scenario: open 狀態 issue 顯示綠色標記
- **WHEN** 渲染一筆 state 為 open 的 GitHub Issue
- **THEN** 氣泡對齊右側，氣泡文字末尾或右下角顯示綠色小圓點狀態標記

#### Scenario: closed 狀態 issue 顯示暗色標記
- **WHEN** 渲染一筆 state 為 closed 的 GitHub Issue
- **THEN** 氣泡對齊右側，氣泡文字末尾或右下角顯示暗色小圓點狀態標記

#### Scenario: 使用者訊息不在左側出現
- **WHEN** 渲染 GitHub Issue 氣泡
- **THEN** 氣泡靠右，左側留有空白（`margin-left: auto`）

### Requirement: 訊息區域可獨立捲動
訊息列表區域（系統訊息 + issue 氣泡）SHALL 可獨立捲動，底部輸入框不隨訊息捲動。

#### Scenario: 訊息超過可視高度時可捲動
- **WHEN** issue 列表筆數超過可視區域高度
- **THEN** 訊息區域出現垂直捲軸（或支援手勢捲動），底部輸入框保持固定不動

#### Scenario: 訊息區域佔據剩餘空間
- **WHEN** 頁面完整渲染
- **THEN** 訊息區域高度為 chat container 高度減去底部輸入框高度，`flex: 1` 自動填滿

### Requirement: 桌機版訊息欄限寬居中
在桌機版（viewport width ≥ 768px）時，聊天訊息內容 SHALL 限寬 `max-width: 60vw` 並水平居中。

#### Scenario: 桌機版訊息不撐滿整欄
- **WHEN** viewport width ≥ 768px 且訊息區域有內容
- **THEN** 訊息列表的內層 wrapper 最大寬度為 60vw，左右 `margin: 0 auto` 居中

#### Scenario: 手機版訊息不受限寬影響
- **WHEN** viewport width < 768px
- **THEN** 訊息列表寬度填滿可用區域，不套用 60vw 限制
