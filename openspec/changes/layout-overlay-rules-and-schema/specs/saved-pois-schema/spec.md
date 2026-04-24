## ADDED Requirements

### Requirement: saved_pois table 儲存使用者的 cross-trip POI 收藏
系統 SHALL 建立 `saved_pois` table，schema：`id INTEGER PK`、`email TEXT NOT NULL`（owner，暫以 email 直到 V2 OAuth）、`poi_id INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE`、`saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`、`note TEXT`。`(email, poi_id)` 為 UNIQUE 複合索引，避免重複收藏。

#### Scenario: 使用者收藏新 POI
- **WHEN** 使用者於 `/explore` 點擊 POI 的儲存按鈕
- **THEN** 系統 INSERT 一筆 `saved_pois` row
- **AND** 回傳 201 with 新 row
- **AND** `saved_at` 自動設為 CURRENT_TIMESTAMP

#### Scenario: 使用者重複收藏同一 POI
- **WHEN** 使用者嘗試收藏已存在的 POI（相同 email + poi_id）
- **THEN** 系統 throw `AppError('DATA_CONFLICT')` HTTP 409
- **AND** 回應訊息「該 POI 已收藏」

#### Scenario: POI 被 delete 時收藏自動清除
- **WHEN** 某 POI row 從 `pois` table 被 DELETE
- **THEN** 所有引用該 poi_id 的 `saved_pois` row SHALL 自動 cascade delete
- **AND** 不產生 orphan

### Requirement: `GET /api/saved-pois` 列出當前使用者收藏清單
系統 SHALL 提供 `GET /api/saved-pois` endpoint，驗證 auth 後回傳當前 email 的所有 `saved_pois` rows，JOIN `pois` 補充 POI 詳細資料（name / address / coords）。回應 camelCase。

#### Scenario: 已登入使用者取收藏清單
- **WHEN** authenticated user 呼叫 `GET /api/saved-pois`
- **THEN** 回傳 200 with `[{id, poiId, poiName, poiAddress, savedAt, note}, ...]`
- **AND** 排序 by `saved_at DESC`

#### Scenario: 未登入使用者取收藏
- **WHEN** unauthenticated request 呼叫 `GET /api/saved-pois`
- **THEN** throw `AppError('AUTH_REQUIRED')` HTTP 401

### Requirement: `POST /api/saved-pois` 新增收藏
系統 SHALL 提供 `POST /api/saved-pois { poiId, note? }` endpoint，驗證 auth 後 INSERT。

#### Scenario: 成功新增收藏
- **WHEN** 傳入 valid poiId 且該 POI 存在於 `pois` table
- **THEN** 系統 INSERT `saved_pois` row
- **AND** 回傳 201 with 新 row

#### Scenario: 傳入不存在的 poiId
- **WHEN** 傳入的 poiId 在 `pois` table 無對應 row
- **THEN** throw `AppError('DATA_NOT_FOUND')` HTTP 404

### Requirement: `DELETE /api/saved-pois/:id` 移除收藏
系統 SHALL 提供 `DELETE /api/saved-pois/:id` endpoint，驗證該 row 屬於當前 email 使用者後才執行。

#### Scenario: 使用者刪除自己的收藏
- **WHEN** authenticated user 刪除 email 相符的 `saved_pois` row
- **THEN** 系統 DELETE 該 row
- **AND** 回傳 204

#### Scenario: 使用者嘗試刪除他人收藏
- **WHEN** authenticated user 嘗試刪除不同 email 的收藏
- **THEN** throw `AppError('PERM_DENIED')` HTTP 403
