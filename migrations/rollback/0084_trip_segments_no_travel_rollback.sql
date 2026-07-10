-- Rollback 0084: 移除 trip_segments.no_travel。
--
-- SQLite 3.35+（D1）支援 `ALTER TABLE trip_segments DROP COLUMN no_travel;`。
-- 先確認已回滾所有 SELECT no_travel 的 code（days/_merge、segments、recompute、clone、import），
-- 否則 DROP 後舊 code SELECT 會 `no such column`。回滾順序：先 revert code deploy，再跑本 rollback。

ALTER TABLE trip_segments DROP COLUMN no_travel;
