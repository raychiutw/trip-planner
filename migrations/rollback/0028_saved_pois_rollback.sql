-- Rollback 0028: saved_pois
--
-- 回滾 CREATE TABLE saved_pois。DROP TABLE 會同時移除附屬 indexes，
-- 無資料損失風險（saved_pois 自身資料會消失，但 `pois` / `trip_permissions`
-- 等上游 table 不受影響，saved_pois 是葉節點）。

DROP TABLE IF EXISTS saved_pois;
