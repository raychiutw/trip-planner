# POST /api/trips — 建立行程端點

## 摘要

新增 `POST /api/trips` 端點，讓 tp-create skill 可透過 API 建立新行程。

## 動機

tp-create skill 引用了不存在的 `POST /api/trips`。API 只有 `PUT /api/trips/:id`（更新），無法建立新行程。

## 影響範圍

| 檔案 | 變更 |
|------|------|
| `functions/api/trips.ts` | 新增 `onRequestPost` |
| `CLAUDE.md` | API 清單加入 POST /api/trips |
| `.claude/skills/tp-create/SKILL.md` | 移除 API 缺口警告，改用 POST |

## 設計決策

- 使用 `db.batch()` 原子操作：INSERT trips + trip_days + trip_permissions + audit_log
- tripId 格式驗證：`/^[a-z0-9-]+$/`，最長 100 字元
- 最多 30 天
- 任何已認證使用者可建立行程
- 建立者自動獲得 admin 權限

## 無 Migration

純新增程式碼，不改 D1 schema。
