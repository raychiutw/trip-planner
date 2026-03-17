## 1. mapRow 統一轉換

- [x] 1.1 建立 `js/map-row.js`：FIELD_MAP + JSON_FIELDS + mapRow + mapRows
- [x] 1.2 撰寫 `tests/unit/map-row.test.js`：全面測試 rename + JSON parse + edge cases
- [x] 1.3 重構 `js/app.js` mapApiDay：基礎轉換改用 mapRow，保留結構性組裝（infoBoxes/locations/travel）
- [x] 1.4 重構 `js/app.js` mapApiMeta：基礎轉換改用 mapRow
- [x] 1.5 更新 `tests/unit/api-mapping.test.js`：配合 mapRow 重構（原測試全部通過，無需修改）

## 2. API tripId 統一

- [x] 2.1 修改 `functions/api/trips.ts`：SELECT 加 `id AS tripId`
- [x] 2.2 修改 `functions/api/trips/[id].ts`：GET response 加 `tripId` 欄位
- [x] 2.3 修改 `js/setting.js`：移除 `t.id || t.tripId`，直接用 `t.tripId`
- [x] 2.4 修改 `js/manage.js`：移除 `t.id || t.tripId`
- [x] 2.5 修改 `js/admin.js`：移除 `t.id || t.tripId`
- [x] 2.6 修改 `js/app.js` resolveAndLoad：移除 `trips[i].id || trips[i].tripId`
- [x] 2.7 更新 `tests/e2e/api-mocks.js`：mock data 改用 `tripId`
- [x] 2.8 更新 `tests/unit/setting-api.test.js`

## 3. 可變狀態命名修正

- [x] 3.1 `js/app.js`：`TRIP` → `trip`（全域搜尋替換 ~50 處）
- [x] 3.2 `js/app.js`：`CURRENT_TRIP_ID` → `currentTripId`
- [x] 3.3 `js/app.js`：`DIST_PATH` 已移除確認
- [x] 3.4 更新受影響的測試（setup.js 加入 map-row.js 全域載入）

## 4. 命名規範驗證

- [x] 4.1 建立 `tests/unit/naming-convention.test.js`：掃描 JS/CSS/API 命名
- [x] 4.2 建立 `.claude/skills/tp-coding-validate/SKILL.md`：commit 前驗證 skill（命名規範 + 測試綠燈，紅燈持續修改）
- [x] 4.3 同步建立 `.gemini/skills/tp-coding-validate/SKILL.md`
- [x] 4.4 更新 pre-commit hook：JS/CSS 變更時跑 naming-convention 測試
- [x] 4.5 更新 CLAUDE.md：加入 tp-coding-validate 說明
- [x] 4.6 執行全套測試確認無 regression
