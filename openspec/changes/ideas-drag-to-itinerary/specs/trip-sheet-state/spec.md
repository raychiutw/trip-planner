## MODIFIED Requirements

### Requirement: Ideas tab 基本 list + add 功能（無 drag）

Ideas tab 內部 SHALL 呼叫 `GET /api/trip-ideas?tripId=xxx` 列出當前 trip 的 ideas，提供一個 `+ Add idea` button 觸發 modal 新增（Phase 1 的 POST API）。**Phase 5 加上 drag 能力**（Ideas card 可拖到 Itinerary Day slot promote），但保留既有「排入行程」text button 作為 keyboard / screen reader a11y fallback。

#### Scenario: Ideas tab 載入
- **WHEN** 使用者打開 Ideas tab
- **THEN** 呼叫 `GET /api/trip-ideas?tripId={current}` 並 render cards
- **AND** 空狀態顯示「尚無 idea，點 + Add 新增」

#### Scenario: 新增 idea
- **WHEN** 使用者點「+ Add idea」
- **THEN** 彈 modal 輸入 title / note（選填 poi）
- **AND** POST 成功後 refresh list

#### Scenario: Ideas → Itinerary promote（text-based fallback，Phase 3 版保留）
- **WHEN** 使用者點某 idea 的「排入行程」button（鍵盤使用者或不想 drag）
- **THEN** 彈 day picker + 時段 input
- **AND** PATCH `trip-ideas/:id { promotedToEntryId: new-entry }` + 同時 INSERT trip_entries
- **AND** idea 狀態變 promoted
- **AND** 排入 itinerary tab 的 timeline

#### Scenario: Ideas → Itinerary promote（drag，Phase 5 新增）
- **WHEN** 使用者 drag 某 idea card 到 Itinerary Day slot
- **THEN** 觸發 drag-to-promote flow（見 `drag-to-promote` spec）
- **AND** optimistic UI 立即更新；API commit 背景跑
- **AND** 完成後 undo toast 5 秒
