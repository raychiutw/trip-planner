## ADDED Requirements

### Requirement: trip_ideas table 儲存 per-trip 的 maybe list
系統 SHALL 建立 `trip_ideas` table：`id INTEGER PK`、`trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE`、`poi_id INTEGER REFERENCES pois(id) ON DELETE SET NULL`（可 null，自由文字 idea）、`title TEXT NOT NULL`、`note TEXT`、`added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`、`added_by TEXT`（email of adder）、`promoted_to_entry_id INTEGER REFERENCES trip_entries(id) ON DELETE SET NULL`、`archived_at TEXT`（soft archive）。

#### Scenario: 使用者新增 POI-based idea 到 trip
- **WHEN** 使用者從探索或 AI chat 加 POI 到 trip 的 Ideas
- **THEN** 系統 INSERT `trip_ideas` row with `poi_id`
- **AND** `title` 自動填 POI name（可覆寫）

#### Scenario: 使用者新增自由文字 idea
- **WHEN** 使用者在 Ideas tab 輸入「也許去超市買零食」無 POI 引用
- **THEN** 系統 INSERT `trip_ideas` row with `poi_id = NULL`
- **AND** `title` 用使用者輸入文字

#### Scenario: Trip 被 delete 時 ideas 自動清
- **WHEN** 某 trip 從 `trips` table 被 DELETE
- **THEN** 所有引用該 trip_id 的 `trip_ideas` row SHALL 自動 cascade delete

#### Scenario: POI 被 delete 時 idea 保留但 poi_id 清空
- **WHEN** 某 POI 從 `pois` table 被 DELETE 而某 idea 曾引用它
- **THEN** 該 idea row 保留（title / note 保留）
- **AND** `poi_id` SET NULL（使用者仍可看到 idea 文字，但失去 POI 連結）

### Requirement: `GET /api/trip-ideas?tripId=xxx` 列出某 trip 的 ideas
系統 SHALL 提供該 endpoint，驗證 auth + 權限（使用者對該 trip 有 trip_permissions）後回傳 `trip_ideas` rows，JOIN `pois` 補 POI 詳細資料。

#### Scenario: 有權限的使用者取 ideas 列表
- **WHEN** authenticated user 對該 trip 有 permission
- **THEN** 回傳 200 with `[{id, tripId, poiId?, poiName?, title, note, addedAt, addedBy, promotedToEntryId?, archivedAt?}, ...]`
- **AND** 排序 by `added_at DESC`
- **AND** 預設 filter out `archived_at IS NOT NULL`（archived ideas 不顯示）

#### Scenario: 無權限使用者取 ideas
- **WHEN** authenticated user 對該 trip 無 permission
- **THEN** throw `AppError('PERM_DENIED')` HTTP 403

### Requirement: `POST /api/trip-ideas` 新增 idea
系統 SHALL 提供 `POST /api/trip-ideas { tripId, poiId?, title, note? }` endpoint，驗證 auth + trip permission 後 INSERT。

#### Scenario: 成功新增 POI-based idea
- **WHEN** 傳入 valid tripId + poiId + auto-fill title
- **THEN** 系統 INSERT `trip_ideas` row
- **AND** `added_by` 設為當前使用者 email
- **AND** 回傳 201 with 新 row

#### Scenario: 傳入不存在的 tripId
- **WHEN** 傳入的 tripId 不存在
- **THEN** throw `AppError('DATA_NOT_FOUND')` HTTP 404

### Requirement: `PATCH /api/trip-ideas/:id` 更新 idea 或 promote 到 entry
系統 SHALL 提供該 endpoint 支援：(1) 修改 title/note，(2) 設 `promoted_to_entry_id`（當 idea 被排入 itinerary），(3) 設 `archived_at`（soft delete）。

#### Scenario: Promote idea 到 itinerary
- **WHEN** 使用者從 Ideas 拖到 Day N（Phase 5 drag flow）
- **THEN** 系統：(1) INSERT `trip_entries` row using idea 的 poi_id / title, (2) UPDATE `trip_ideas.promoted_to_entry_id = {新 entry id}`
- **AND** idea row 保留（供 undo / audit）

#### Scenario: 使用者 archive idea
- **WHEN** 使用者刪除某個 idea（不 hard delete）
- **THEN** 系統 UPDATE `archived_at = CURRENT_TIMESTAMP`
- **AND** default GET query 不再回傳該 row

### Requirement: trip_ideas 不可動 trip_entries 現有語意
變更 `trip_ideas.promoted_to_entry_id` SHALL NOT 影響既有 `trip_entries` row 的 start_time / day_id / order_in_day；Ideas 只是新增、不改 entry 本身行為。

#### Scenario: Promote 時不改既有 entry 排序
- **WHEN** 某 idea promote 到新 entry
- **THEN** 新 entry INSERT 不動其他 entry 的 `order_in_day`（新 entry 預設 0 + Phase 5 drag reorder 時再改）
