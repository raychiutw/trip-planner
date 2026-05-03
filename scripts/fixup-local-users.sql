-- fixup-local-users.sql — Local dev DB cleanup for V2 owner email→user_id cutover
--
-- 為什麼需要：scripts/seed.sql 與 backups/*/trips.json 是 V2 OAuth 之前的資料，
-- trips.owner 欄位混合 email 與 display name（HuiYun, Ray, Onion 等）。
-- V2 cutover (migration 0046) 要求所有 owner 都能 JOIN 到 users.email。
--
-- 此 script 為本地 dev DB 補上 synthetic users + 更新 trips.owner 為 email format。
-- Prod 不跑此 script — prod 必須用 verify-user-backfill.ts 找出 orphan、手動處理
-- (要求該 user 走 V2 OAuth 註冊 / 或刪除 abandoned trip)。
--
-- Usage:
--   npx wrangler d1 execute trip-planner-db --local --file scripts/fixup-local-users.sql
--
-- 跑完後驗證：bun scripts/verify-user-backfill.ts --local 應 PASS
--
-- 適用：init-local-db.js 用 backup JSON 重建 DB 後立即跑，否則 verify 會失敗。

-- 1. Synthetic users for seed display names (idempotent — INSERT OR IGNORE)
INSERT OR IGNORE INTO users (id, email, display_name, created_at, updated_at) VALUES
  ('hui-yun-local',         'huiyun@test.local',         'HuiYun',         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('onion-local',           'onion@test.local',          'Onion',          '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('celiademykathy-local',  'celiademykathy@test.local', 'CeliaDemyKathy', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('mimichu-local',         'mimichu@test.local',        'MimiChu',        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('aeronan-local',         'aeronan@test.local',        'AeronAn',        '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('rayhus-local',          'rayhus@test.local',         'RayHus',         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('penyin-local',          'penyin@gmail.com',          'Penyin',         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- 2. trips.owner display name → email
UPDATE trips SET owner = 'lean.lean@gmail.com'         WHERE owner = 'Ray';
UPDATE trips SET owner = 'huiyun@test.local'           WHERE owner = 'HuiYun';
UPDATE trips SET owner = 'onion@test.local'            WHERE owner = 'Onion';
UPDATE trips SET owner = 'celiademykathy@test.local'   WHERE owner = 'CeliaDemyKathy';
UPDATE trips SET owner = 'mimichu@test.local'          WHERE owner = 'MimiChu';
UPDATE trips SET owner = 'aeronan@test.local'          WHERE owner = 'AeronAn';
UPDATE trips SET owner = 'rayhus@test.local'           WHERE owner = 'RayHus';
