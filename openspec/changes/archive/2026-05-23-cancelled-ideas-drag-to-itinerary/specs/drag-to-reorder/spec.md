## ADDED Requirements

### Requirement: Itinerary entry 可拖動重排（within-Day + cross-Day）
Itinerary tab 的 entry cards SHALL 是 draggable，每 Day slot SHALL 是 drop target（同 Day 內 reorder + cross-Day move）。

#### Scenario: 同 Day 內拖動重排
- **WHEN** 使用者 drag entry A 到同 Day 的 entry B 之上
- **THEN** 系統 swap A 和 B 的 order_in_day
- **AND** A 的 start_time 更新為 B 的 start_time（兩者 swap）
- **AND** 後端 batch UPDATE 兩個 entries

#### Scenario: Cross-Day 移動
- **WHEN** 使用者 drag entry A 從 Day 1 到 Day 3
- **THEN** 系統 UPDATE `entry A.day_id = day3`
- **AND** start_time 使用 smart placement（Day 3 最後 entry + 1h，或 default 時段）
- **AND** Day 1 其他 entries 的 order_in_day 重整（fill gap）

#### Scenario: Cross-Day 拖到具體時段
- **WHEN** 使用者 drag entry A 到 Day 2 的 14:00 slot
- **THEN** UPDATE `day_id=day2, start_time='14:00'`
- **AND** 若時段衝突彈 ConflictModal（同 promote scenario）

### Requirement: Entry 拖回 Ideas 觸發 demote
Itinerary 的 entry SHALL 可拖到 Ideas section 的 drop zone，觸發 demote：
1. DELETE 該 `trip_entries` row
2. INSERT `trip_ideas` row（保留 poi_id / title / note）或 UPDATE 原 idea（若 idea 曾被 promote 則更新 `promoted_to_entry_id = NULL`）

#### Scenario: Demote promoted entry（原 Ideas 還在）
- **WHEN** 使用者 drag entry A（A 來自 idea X）到 Ideas section
- **THEN** DELETE entry A
- **AND** UPDATE idea X 的 `promoted_to_entry_id = NULL`（恢復未 promote 狀態）
- **AND** A 的 day_id / start_time 資訊 lost（可接受）

#### Scenario: Demote 原本非 Ideas 來源的 entry
- **WHEN** 使用者 drag entry B（B 是直接建的 trip_entry，不從 Ideas 來）到 Ideas
- **THEN** DELETE entry B
- **AND** INSERT 新 idea `trip_ideas { poi_id: B.poi_id, title: B.title, note: B.note, promotedToEntryId: NULL }`
- **AND** Ideas tab 出現新 idea

#### Scenario: Demote 確認 modal（destructive）
- **WHEN** drop 到 Ideas section
- **THEN** 彈 modal「確認移回 Ideas？時段資訊會清除」with 確認 / 取消 button
- **AND** confirm 才 execute；否則取消 drag

### Requirement: Batch update 優化 D1 寫入
同 Day 內 reorder 多 entries 時 SHALL 用單一 transaction batch update，避免 N+1 write。

#### Scenario: 拖動觸發 5 entries 的 order_in_day 更新
- **WHEN** drop 後需更新 5 個 entries 的 order_in_day
- **THEN** 後端用 `db.batch([stmt1, stmt2, ...])` D1 API 一次送出
- **AND** atomically 更新或全失敗

### Requirement: Drag keyboard 支援（a11y）
Entry cards + Idea cards SHALL 支援 keyboard drag：
- Space: pick up
- Arrow keys: move
- Enter: drop
- Esc: cancel

#### Scenario: 鍵盤使用者 reorder
- **WHEN** focus 某 entry + press Space → Down arrow × 2 → Enter
- **THEN** entry 被 drop 到下方第 2 個位置
- **AND** order_in_day 正確更新

#### Scenario: 鍵盤使用者取消
- **WHEN** 使用者 Space pick up → 改變主意 press Esc
- **THEN** entry 回原位置，無 API 呼叫
