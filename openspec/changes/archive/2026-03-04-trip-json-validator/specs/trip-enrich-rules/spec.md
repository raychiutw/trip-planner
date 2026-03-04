## MODIFIED Requirements

### Requirement: R2 餐次完整性
每日 timeline SHALL 包含午餐和晚餐。若缺少，SHALL 插入「餐廳未定」timeline entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等含導遊的固定行程包）不補午餐，晚餐依到達地點推薦。**航程到達日與出發日 SHALL 依航班時間判斷餐次需求**：到達日以到達時間、出發日以出發時間為基準，11:30 前到達/出發影響午餐、17:00 前影響晚餐。無 flights 資料時退回每日皆須午晚餐的傳統檢查。

#### Scenario: 缺午餐補齊
- **WHEN** 某日 timeline 無午餐 entry 且非一日遊團且非航程豁免日
- **THEN** SHALL 在適當時間點插入 `{ title: "午餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 缺晚餐補齊
- **WHEN** 某日 timeline 無晚餐 entry 且非航程豁免日
- **THEN** SHALL 在適當時間點插入 `{ title: "晚餐（餐廳未定）" }` entry，含 restaurants infoBox 推薦 3 家

#### Scenario: 一日遊團不補午餐
- **WHEN** 某日行程為 KKday/Klook 等一日遊團體行程
- **THEN** SHALL 不補午餐，晚餐依團體行程結束後到達地點推薦

#### Scenario: 去程到達日餐次判斷
- **WHEN** 行程含 flights 且該日為去程到達日
- **THEN** 到達時間 < 11:30 → 須補午餐 + 晚餐；11:30 ≤ 到達 < 17:00 → 須補晚餐；≥ 17:00 → 晚餐可選

#### Scenario: 回程出發日餐次判斷
- **WHEN** 行程含 flights 且該日為回程出發日
- **THEN** 出發時間 < 11:30 → 不需午晚餐；11:30 ≤ 出發 < 17:00 → 須有午餐；≥ 17:00 → 須有午餐 + 晚餐

#### Scenario: 無 flights 退回傳統檢查
- **WHEN** 行程 JSON 不含 flights 或無法解析到達/出發時間
- **THEN** SHALL 退回每日皆須午餐 + 晚餐的傳統檢查

## ADDED Requirements

### Requirement: R8 早餐欄位
每日 hotel 物件 SHALL 包含 `breakfast` 欄位，記錄該飯店早餐安排。使用者可指定飯店含早餐或自行解決；未指定時標記為「資料未提供」。若查得到飯店退房時間，SHALL 以 `checkout` 欄位記錄。

#### Scenario: 飯店含早餐
- **WHEN** 使用者指定飯店含早餐
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": true, "note": "早餐說明（如料理類型）" }`

#### Scenario: 自行解決早餐
- **WHEN** 使用者指定自行解決早餐
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": false }`

#### Scenario: 資料未提供
- **WHEN** 使用者未指定早餐安排
- **THEN** `hotel.breakfast` SHALL 為 `{ "included": null }`，顯示「早餐：資料未提供」

#### Scenario: 退房時間
- **WHEN** 可查到飯店最後退房時間
- **THEN** `hotel.checkout` SHALL 記錄退房時間字串（如 `"11:00"`）

#### Scenario: 退房時間未知
- **WHEN** 無法查到飯店退房時間
- **THEN** `hotel.checkout` SHALL 不存在（選填欄位）

### Requirement: R9 AI 亮點精簡
`highlights.content.summary` SHALL 為 50 字以內的旅程風格評語，不列舉具體景點或行程細節。`tags` 陣列保持不變。

#### Scenario: 字數限制
- **WHEN** 產生或修改 `highlights.content.summary`
- **THEN** 字數（中英文字元含標點，不含空白）SHALL ≤ 50

#### Scenario: 不列舉景點
- **WHEN** 撰寫 summary
- **THEN** SHALL 不包含 "Day X" 開頭的行程列舉、不列舉具體景點名稱或交通方式

#### Scenario: 風格評語
- **WHEN** 撰寫 summary
- **THEN** SHALL 以旅程整體風格、特色、適合對象等角度撰寫評語
