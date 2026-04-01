-- Migration 0013: hotels 表新增 location_json 欄位（Day Map feature F001）
-- 安全性確認：
--   hotels: 被 days ON DELETE CASCADE 引用，此為 additive change（加欄位），向後相容
--   不涉及 DROP TABLE，無資料遺失風險

ALTER TABLE hotels ADD COLUMN location_json TEXT;
