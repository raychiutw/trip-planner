# Tasks: days 必填欄位驗證

## 0. DB Migration

- [x] 0.1 撰寫 `migrations/0010_days_not_null.sql`（recreate days table, date/day_of_week/label NOT NULL）
- [x] 0.2 本地驗證 migration SQL 語法正確

## 1. API 端點

- [x] 1.1 `PUT /days/:num` 加入 date/dayOfWeek/label 必填驗證（400 error）
- [x] 1.2 加入 date 格式驗證（YYYY-MM-DD）
- [x] 1.3 加入 label 長度驗證（≤ 8 字）
- [x] 1.4 撰寫 unit test 覆蓋驗證邏輯

## 2. Skill 文件

- [x] 2.1 tp-create SKILL.md：明確標示 days meta 必填欄位
- [x] 2.2 tp-edit SKILL.md：覆寫整天時保留 meta 欄位
- [x] 2.3 tp-rebuild SKILL.md：加入 days meta 缺漏修復邏輯
