-- Rollback 0085: 還原 trip_days.title 欄（TEXT nullable）。
-- 注意：僅還原「欄位結構」，原本的 title 資料在 DROP 時已丟棄、無法復原。
ALTER TABLE trip_days ADD COLUMN title TEXT;
