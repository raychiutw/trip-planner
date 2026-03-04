## MODIFIED Requirements

### Requirement: R2 餐次完整性（修改一日遊午餐行為）

#### Scenario: 一日遊團午餐 entry（修改）
- **WHEN** 某日行程為 KKday/Klook 等一日遊團體行程
- **THEN** SHALL 插入午餐 timeline entry，`title` 為「午餐（團體行程已含）」，不附 `infoBoxes[type=restaurants]`
- **AND** 晚餐依團體行程結束後到達地點推薦（不變）

### Requirement: R4 景點品質（修改 blogUrl 可選）

#### Scenario: 景點 blogUrl 查無結果（新增）
- **WHEN** Google 搜尋「{景點名} {地區} 推薦」無適合的繁體中文文章
- **THEN** `blogUrl` SHALL 為 `null`

#### Scenario: 景點 titleUrl 查無官網（釐清，不變）
- **WHEN** 景點無官方網站
- **THEN** `titleUrl` SHALL 為 `null`

### Requirement: R5 飯店品質（修改 blogUrl 可選）

#### Scenario: 飯店 blogUrl 查無結果（新增）
- **WHEN** Google 搜尋「{飯店名} 推薦」無適合的繁體中文文章
- **THEN** `blogUrl` SHALL 為 `null`

### Requirement: R6 搜尋方式（修改允許 null）

#### Scenario: 搜尋無結果（新增）
- **WHEN** Google 搜尋無繁體中文文章結果或結果明顯不相關
- **THEN** `blogUrl` SHALL 設為 `null`，不放不相關連結

### Requirement: R7 購物景點推薦（新增生成 checklist）

#### Scenario: 飯店購物 infoBox 生成（新增）
- **WHEN** 飯店物件的 `infoBoxes` 不存在或不含 `type=shopping`
- **THEN** SHALL 新建 `infoBoxes` 陣列（若不存在）並加入 `type=shopping` infoBox
- **AND** SHALL 搜尋飯店附近超市/超商/唐吉軻德，補到 3+ shops
- **AND** shopping infoBox SHALL 放在 `hotel.infoBoxes`，不放在 timeline entry

#### Scenario: 飯店購物 infoBox 兩階段 checklist（新增）
- **WHEN** 執行 R7 檢查
- **THEN** SHALL 先執行「驗證既有」（category 標準化、欄位完整性），再執行「生成缺漏」（逐日檢查每間飯店是否有 shopping infoBox，缺者新建）
