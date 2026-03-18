## ADDED Requirements

### Requirement: Reservation JSON 解析渲染
Restaurant 元件 SHALL 解析 `reservation` 欄位的 JSON 物件，依 `method` 欄位渲染對應 UI。若欄位為純字串，SHALL 向後相容直接渲染。

#### Scenario: method=website 網站訂位
- **WHEN** reservation 為 `{"available":"yes","method":"website","url":"https://example.com","recommended":true}`
- **THEN** 渲染為可點擊的外部連結，文字為「建議訂位」，連結指向 url 欄位

#### Scenario: method=phone 電話訂位
- **WHEN** reservation 為 `{"available":"yes","method":"phone","phone":"0980-54-5087","recommended":true}`
- **THEN** 渲染為可撥打的 tel: 連結，顯示電話號碼

#### Scenario: available=no 免預約
- **WHEN** reservation 為 `{"available":"no","recommended":false}`
- **THEN** 不渲染訂位區塊（不顯示任何訂位資訊）

#### Scenario: 純字串向後相容
- **WHEN** reservation 為純字串（如「需預約」或電話號碼）
- **THEN** 維持原有渲染邏輯（搭配 reservationUrl 產生連結或顯示純文字）

#### Scenario: reservation 為 null
- **WHEN** reservation 欄位為 null 或空
- **THEN** 不渲染訂位區塊
