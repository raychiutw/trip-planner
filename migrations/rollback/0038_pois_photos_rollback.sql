-- Rollback for migration 0038: 移除 pois.photos 欄位
--
-- 執行時機：發現 photos column 設計需大改（schema shape 變動 / 拆獨立表）時。
-- 前置：先 backup `SELECT id, photos FROM pois WHERE photos IS NOT NULL;`
-- 確認沒有用戶上傳的不可丟資料（Wikimedia 抓的可重抓無妨）。
--
-- SQLite 3.35+ 支援 ALTER TABLE DROP COLUMN，D1 走的是現代版本。

ALTER TABLE pois DROP COLUMN photos;
