-- Rollback 0029: trip_ideas
--
-- 回滾 CREATE TABLE trip_ideas。DROP TABLE 同時移除附屬 indexes。
-- trip_ideas 是葉節點，上游 trips / pois / trip_entries 不受影響；
-- ideas 自身資料會消失（no backfill path — Phase 1 ship 前無資料）。

DROP TABLE IF EXISTS trip_ideas;
