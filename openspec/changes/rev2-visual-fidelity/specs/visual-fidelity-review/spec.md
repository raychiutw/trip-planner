## ADDED Requirements

### Requirement: 雙視窗截圖

視覺類檢視（/qa 視覺維度、/design-review）SHALL 同時在**手機 390×844**（= iOS HIG）與**桌機 1440×900**（= macOS HIG）兩視窗截圖。本 app 兩視窗渲染不同（trips = 手機卡片 vs 桌機三欄），只截單一視窗 MUST NOT 視為完成。

#### Scenario: 只截一個視窗不算完成

- **WHEN** 檢視某頁的視覺
- **THEN** 檢視者 SHALL 手機 + 桌機各截一次;若只截其一,結論 SHALL NOT 宣稱「已完整檢視 / 0 偏離」

#### Scenario: 桌機三欄 shell 必截

- **WHEN** 頁在桌機以三欄 shell 呈現（trips/trip detail/操作）
- **THEN** SHALL 截桌機三欄態,不得只截手機

### Requirement: 逐元件 computed 對 token

每個互動元件（按鈕/tab/搜尋/膠囊/sticky strip）SHALL 3× zoom clip 放大**並**用 `getComputedStyle` 取實測值（寬高/背景/border/padding/對齊），對照 ①44pt 觸控區 ②DESIGN.md token ③水平/垂直置中。判定 SHALL 用實測值,MUST NOT 只憑肉眼印象。

#### Scenario: 觸控區不足以實測值抓出

- **WHEN** 檢視一個可點元件
- **THEN** SHALL 讀其 computed 尺寸;若 < 44pt 觸控區 SHALL 記為 finding

#### Scenario: 置中以實測判定

- **WHEN** 檢視元件是否在容器置中
- **THEN** SHALL 比對元件中心與容器中心的實測座標,不憑肉眼估

### Requirement: mockup / DESIGN.md 並排比對

視覺檢視 SHALL 開對應 mockup（`docs/design-sessions/*.html`）截同元件並排比 layout/間距/對齊/色/字級/形制;無 mockup 則對 DESIGN.md 條文。與 mockup/token 任何不符 SHALL 記為 finding。

#### Scenario: 偏離即 finding

- **WHEN** 元件與 mockup/token 有可見差異
- **THEN** SHALL 記為 finding,MUST NOT 略過

### Requirement: sticky 元件檢視捲動態

sticky 元件（day tab、titlebar 等）SHALL 在**捲動後**截圖,檢查與上層的間距/重疊/穿透。靜態首屏截圖 MUST NOT 視為已檢視 sticky 行為。

#### Scenario: 捲動後檢查間距與重疊

- **WHEN** 頁含 sticky 元件
- **THEN** SHALL 捲動後截圖驗證其與相鄰 sticky 層的間距、無重疊/穿透

### Requirement: 不得合理化偏離

檢視者 MUST NOT 用「async 慢載 / 環境問題 / intended」打發一個視覺異常,除非**查證**了 token 值或程式註解確認確為 intended。未查證即合理化 SHALL 視為漏檢。

#### Scenario: 合理化前先查證

- **WHEN** 看到視覺異常想歸因於「intended」
- **THEN** SHALL 先查 token 值/程式註解佐證;查不到佐證則 SHALL 當 finding 處理
