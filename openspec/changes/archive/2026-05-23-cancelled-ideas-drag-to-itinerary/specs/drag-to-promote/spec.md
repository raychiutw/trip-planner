## ADDED Requirements

### Requirement: Ideas card 可拖到 Day slot promote 成 entry
Ideas tab 的每張 idea card SHALL 是 draggable，Itinerary 的每個 Day（或具體時段 slot）SHALL 是 drop target。拖動完成後：
1. 新建 `trip_entries` row（poi_id / title / day_id / start_time）
2. 更新 `trip_ideas.promoted_to_entry_id = new_entry.id`
3. Ideas list 該 idea 顯示「已 promote」狀態（灰色 + icon）

#### Scenario: 拖 idea 到 Day 2 具體時段
- **WHEN** 使用者 drag idea X 到 Day 2 的 14:00 時段 slot
- **THEN** 系統 INSERT `trip_entries { trip_id, poi_id, day_id: day2, start_time: '14:00', ... }`
- **AND** PATCH `trip_ideas/X { promotedToEntryId: new_entry_id }`
- **AND** Itinerary tab 該 Day 即時出現新 entry
- **AND** Ideas tab 該 idea 顯示灰色 + 「已加入行程」badge

#### Scenario: 拖 idea 到 Day 但不指定時段
- **WHEN** 使用者 drag idea 到 Day 3 header（非具體時段）
- **THEN** 系統 smart placement：算出該 Day 最後 entry 結束時間 + 1h
- **AND** 若無 entry，default 09:00 + duration 1h
- **AND** INSERT entry with 該智慧時段

#### Scenario: 拖 idea 到已有 entry 衝突時段
- **WHEN** 使用者 drop 時段與既有 entry 重疊（例既有 entry 14:00-16:00，新 idea 14:30）
- **THEN** 彈 Conflict Modal：「此時段已有 XX，怎麼辦？」選項：換位置 / 併排 / 取消
- **AND** 選換位置 → 新 entry 插入 + 自動擠既有 entry 到新空檔
- **AND** 選併排 → 新 entry 與既有 entry 同時段（order_in_day 區分順序）
- **AND** 選取消 → 不變更，idea 留原 Ideas

#### Scenario: 拖動中網路斷線
- **WHEN** drag 完成後 API 呼叫失敗
- **THEN** 前端 optimistic UI 立即 revert（idea 留 Ideas 原位）
- **AND** toast「加入行程失敗，請重試」
- **AND** Sentry log error

### Requirement: Undo toast 於 drag 完成後 5 秒內可 revert
drag 完成 commit API 後 SHALL 顯示 toast「已加入 Day N」+ 「undo」button，5 秒內可點。

#### Scenario: 使用者點 undo
- **WHEN** 5 秒內點 toast undo
- **THEN** 系統 DELETE 新 entry + 清 `trip_ideas.promoted_to_entry_id` 為 NULL
- **AND** Ideas tab idea 恢復「未 promote」狀態

#### Scenario: 5 秒超時
- **WHEN** 5 秒後 toast 自動消失
- **THEN** drag 結果為最終狀態，無 undo 選項

### Requirement: 保留 Phase 3 的 text-based 「排入行程」button a11y fallback
此 drag feature SHALL 不移除 Phase 3 既有的「排入行程」text button；該 button 作為鍵盤 / 螢幕閱讀器使用者的 fallback。

#### Scenario: 鍵盤使用者 promote idea
- **WHEN** 使用者用 Tab + Enter 操作「排入行程」button
- **THEN** 彈既有 day picker modal（text-based flow）
- **AND** submit 後同樣 INSERT entry + PATCH idea
