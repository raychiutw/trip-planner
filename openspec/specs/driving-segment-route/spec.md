## ADDED Requirements

### Requirement: 交通路段顯示起點與終點名稱
交通統計的每個 Segment SHALL 包含 `from`（起點）和 `to`（終點）名稱，從 timeline entries 的 title 推導。

#### Scenario: 連續 entries 之間的交通
- **WHEN** entry[i] title 為「首里城」且 entry[i].travel 存在，entry[i+1] title 為「美麗海水族館」
- **THEN** 該 Segment 的 from 為「首里城」、to 為「美麗海水族館」

#### Scenario: 最後一個 entry 的交通
- **WHEN** entry[i] 為最後一個 entry 且 travel 存在
- **THEN** 該 Segment 的 from 為 entry[i].title、to 為 undefined

### Requirement: DrivingStats 渲染路段名稱
DrivingStats 元件 SHALL 在每段交通前顯示「from → to」路段名稱。

#### Scenario: 有完整 from 和 to
- **WHEN** Segment 有 from=「首里城」和 to=「美麗海水族館」
- **THEN** 渲染為「首里城 → 美麗海水族館 約37分鐘」

#### Scenario: 只有 from 無 to
- **WHEN** Segment 有 from=「美麗海水族館」但 to 為 undefined
- **THEN** 渲染為「美麗海水族館 → … 約15分鐘」或只顯示「美麗海水族館 約15分鐘」
