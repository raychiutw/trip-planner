-- Rollback 0092: 移除 trip_requests.terminal_reason。
--
-- 有損但無害：只丟掉「為什麼終結」的分類，status 本身不受影響（終結與否仍正確）。
-- nullable 欄、無 index、無 FK 依賴 → DROP COLUMN 安全，不需 swap。
--
-- ⚠️ 先確認讀寫 terminal_reason 的 code 已下線，否則 `no such column` 硬崩。

ALTER TABLE trip_requests DROP COLUMN terminal_reason;
