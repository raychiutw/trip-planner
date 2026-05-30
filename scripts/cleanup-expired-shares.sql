-- v2.42.0 (C1): trip_shares cleanup — hard-delete links long past their expiry.
--
-- expires_at is epoch ms (NULL = never). 30-day grace so a recently-expired link's
-- retained view_count lingers briefly before the token-hash material is purged, keeping
-- the trip_shares table (and its UNIQUE token_hash index) from growing without bound.
--
-- Idempotent: re-run → 0 effect. Active (NULL expiry) + within-grace links untouched.
DELETE FROM trip_shares
WHERE expires_at IS NOT NULL
  AND expires_at < (CAST(strftime('%s', 'now') AS INTEGER) - 2592000) * 1000;
