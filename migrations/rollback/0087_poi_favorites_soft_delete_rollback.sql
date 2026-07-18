-- Rollback 0087: 回 full UNIQUE(user_id, poi_id) + 移除 deleted_at 欄。
--
-- ⚠️ 有損：soft-delete 期間同 (user,poi) 可能存在多筆 row（多筆 soft-deleted，或 soft-deleted + active）。
-- 回 full unique 前必須先去重，否則撞唯一性。策略：每 (user,poi) 只留一筆（優先 active、其次最新收藏）。
-- 這會永久丟棄多餘的 soft-deleted tombstone（rollback 本就放棄 undo 能力，可接受）。

-- 1. 去重：每 (user,poi) 保留 active（deleted_at NULL）優先、否則 favorited_at 最新那筆。
DELETE FROM poi_favorites WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, poi_id
      ORDER BY (deleted_at IS NULL) DESC, favorited_at DESC, id DESC
    ) AS rn
    FROM poi_favorites
  ) WHERE rn = 1
);

-- 2. swap 回原結構（table-level UNIQUE、無 deleted_at）。
CREATE TABLE poi_favorites_old (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poi_id       INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  favorited_at TEXT NOT NULL DEFAULT (datetime('now')),
  note         TEXT,
  UNIQUE (user_id, poi_id)
);
INSERT INTO poi_favorites_old (id, user_id, poi_id, favorited_at, note)
  SELECT id, user_id, poi_id, favorited_at, note FROM poi_favorites;
DROP TABLE poi_favorites;
ALTER TABLE poi_favorites_old RENAME TO poi_favorites;
CREATE INDEX idx_poi_favorites_poi ON poi_favorites(poi_id);
