-- Rollback for migration 0027: 把 trip_entries 四欄加回來
--
-- 執行時機：僅當 Phase 3 ship 後發現需回退、且 Phase 2 fallback 路徑有被重新
-- 啟用的情況。單跑此 rollback 只能恢復 schema，欄位資料會是空的 — 必須搭配
-- Phase 3 執行前留的 backup restore。
--
-- 前置檢查：
--   1. 確認 0027 已實際 apply 過（SELECT * FROM pragma_table_info('trip_entries')
--      不再包含 location / maps / mapcode / google_rating 欄位）
--   2. 若 rollback 是為了切回 Phase 2 fallback 路徑，記得 revert 對應的 API / src code
--      （PATCH ALLOWED_FIELDS、POST / PUT 的 INSERT 欄位、mapDay / useMapData 的 fallback 讀取）

ALTER TABLE trip_entries ADD COLUMN location TEXT;
ALTER TABLE trip_entries ADD COLUMN maps TEXT;
ALTER TABLE trip_entries ADD COLUMN mapcode TEXT;
ALTER TABLE trip_entries ADD COLUMN google_rating REAL;
