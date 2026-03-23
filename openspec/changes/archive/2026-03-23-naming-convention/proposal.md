## Why

D1 遷移後前端出現大量 DB→JS 命名轉換的 ad-hoc code（7 個 rename 散落在 mapApiDay 各處）。`tripId` 同一概念在不同層有三種命名（`id`/`trip_id`/`tripId`），模組級可變狀態 `TRIP`/`CURRENT_TRIP_ID` 用 UPPER_CASE 看起來像常數。需要統一命名規範並建立自動化驗證。

## What Changes

- 新增 `js/map-row.js`：統一的 DB→JS 欄位映射工具（取代 mapApiDay/mapApiMeta 中散寫的 if rename）
- 修改所有 API endpoints：`/api/trips` 回傳 `tripId` 取代 `id`
- 修改 `js/app.js`：`TRIP` → `trip`、`CURRENT_TRIP_ID` → `currentTripId`，使用 mapRow
- 修改 `js/setting.js`、`js/manage.js`、`js/admin.js`：移除 `t.id || t.tripId` 防禦性寫法
- 新增 `.claude/skills/tp-naming/SKILL.md`：命名規範驗證 skill
- 新增 `tests/unit/naming-convention.test.js`：自動掃描 codebase 驗證命名規範
- 更新 pre-commit hook：加入命名規範驗證

## Capabilities

### New Capabilities
- `map-row`: 統一 DB→JS 欄位映射工具函式（mapRow, mapRows），集中管理所有 snake_case→camelCase rename + JSON parse
- `naming-lint`: 命名規範自動驗證（掃描 JS/CSS/HTML，檢查違規），整合為 skill + pre-commit

### Modified Capabilities
（無既有 spec 需修改）

## Impact

**修改的檔案：**
- `js/app.js` — mapApiDay/mapApiMeta 重構為使用 mapRow，TRIP/CURRENT_TRIP_ID 改 camelCase
- `js/setting.js`、`js/manage.js`、`js/admin.js` — 移除 `t.id || t.tripId`
- `functions/api/trips.ts` — SELECT 加 `id AS tripId`
- `functions/api/trips/[id].ts` — 回傳加 tripId
- `functions/api/my-trips.ts` — 已用 `tripId`（不需改）
- `tests/unit/api-mapping.test.js` — 更新配合 mapRow
- `tests/unit/naming-convention.test.js` — 新增
- `.claude/skills/tp-naming/SKILL.md` — 新增
- `openspec/config.yaml` — 已更新命名規範
- pre-commit hook — 加入命名驗證
