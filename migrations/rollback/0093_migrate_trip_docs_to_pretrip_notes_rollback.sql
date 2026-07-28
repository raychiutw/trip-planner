-- Rollback 0093: 移除搬進 trip_pretrip_notes 的 legacy-docs 列。
--
-- 靠 semantic_key 前綴精準辨識，不會誤刪任何其他筆記。
-- ⚠️ 若 owner 已在 App 編輯過某筆（managed_by 翻成 'human'），這裡仍會刪掉它 ——
-- rollback 的語意是「回到 0093 之前」，那筆列在 0093 之前本來就不存在。

DELETE FROM trip_pretrip_notes WHERE semantic_key LIKE 'legacy-docs:%';
