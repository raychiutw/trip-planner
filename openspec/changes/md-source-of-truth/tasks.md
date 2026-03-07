## 1. 資料準備：meta.md 補欄位

- [x] 1.1 為所有 `data/trips-md/*/meta.md` frontmatter 新增 `name` 和 `owner` 欄位（從 `data/trips.json` 對映取得）
- [x] 1.2 驗證每個 meta.md 的 `name`/`owner` 正確對映

## 2. trip-build.js 支援 name/owner

- [x] 2.1 修改 `scripts/trip-build.js`：讀取 meta.md 的 `name`/`owner` 欄位，輸出到 `meta.json`
- [x] 2.2 手動跑一個行程 trip-build 驗證 meta.json 包含 `name`/`owner`

## 3. build.js 取代 build-all.js

- [x] 3.1 建立 `scripts/build.js`：掃描 `data/trips-md/*/` 對每個跑 trip-build.js，失敗不中斷
- [x] 3.2 build.js 最後掃描 `data/dist/*/meta.json` 彙整產生 `data/dist/trips.json`（格式：`[{ slug, name, dates, owner }]`）
- [x] 3.3 更新 `package.json` 的 `build` script 為 `node scripts/build.js`
- [x] 3.4 執行 `npm run build` 驗證 dist/trips.json 正確產生

## 4. 前端改讀 dist/trips.json

- [x] 4.1 修改 `js/setting.js`：fetch 路徑改為 `data/dist/trips.json`，renderTripList 直接用 `t.slug`
- [x] 4.2 修改 `js/edit.js`：fetch 路徑改為 `data/dist/trips.json`
- [x] 4.3 修改 `js/app.js`：移除 `TRIP_FILE` 全域變數
- [x] 4.4 修改 `js/app.js`：`fileToSlug` 移除 `data/trips/` 分支，只保留 `data/dist/` 格式

## 5. Skills 改為操作 MD

- [x] 5.1 更新 `.claude/commands/tp-create.md`：產出格式改為 MD 檔案群，白名單改為 `data/trips-md/` + `data/dist/`
- [x] 5.2 更新 `.claude/commands/tp-edit.md`：讀寫路徑改為 `data/trips-md/{slug}/`，列行程改讀 `data/dist/trips.json`
- [x] 5.3 更新 `.claude/commands/tp-rebuild.md`：操作路徑改為 `data/trips-md/{slug}/`
- [x] 5.4 更新 `.claude/commands/tp-rebuild-all.md`：操作路徑改為 `data/trips-md/*/`
- [x] 5.5 更新 `.claude/commands/tp-check.md`：檢查對象改為 MD frontmatter
- [x] 5.6 更新 `.claude/commands/tp-issue.md`：跟隨 tp-edit 路徑變更
- [x] 5.7 更新 `.claude/commands/tp-patch.md`：操作路徑改為 MD
- [x] 5.8 更新 `.claude/commands/trip-quality-rules.md`：移除對完整 JSON 的路徑參照

## 6. 測試更新

- [x] 6.1 更新 `tests/json/schema.test.js`：掃描路徑改為 `data/dist/*/`，從分檔 JSON 組合驗證
- [x] 6.2 更新 `tests/json/quality.test.js`：掃描路徑改為 `data/dist/*/`
- [x] 6.3 更新或重寫 `tests/json/registry.test.js`：驗證 `data/dist/trips.json` 格式正確
- [x] 6.4 更新 `tests/unit/routing.test.js`：移除 `data/trips/` 相關測試案例
- [x] 6.5 更新 `.claude/settings.json` Hook：觸發路徑從 `data/trips/*.json` 改為 `data/trips-md/**/*.md`，指令改為 `npm run build && npm test -- tests/json/`
- [x] 6.6 執行全部測試確認通過

## 7. 刪除冗餘檔案

- [x] 7.1 刪除 `data/trips/*.json`（所有完整行程 JSON）
- [x] 7.2 刪除 `data/trips.json`（手動 registry）
- [x] 7.3 刪除 `data/backup/` 目錄
- [x] 7.4 刪除 `scripts/trip-split.js`
- [x] 7.5 刪除 `scripts/diff-roundtrip.js`
- [x] 7.6 刪除 `scripts/build-all.js`
- [x] 7.7 刪除 `tests/unit/trip-roundtrip.test.js`
- [x] 7.8 刪除 `poc.html`
- [x] 7.9 執行全部測試確認刪除後無破損

## 8. 文件與記憶更新

- [x] 8.1 更新 `CLAUDE.md`：移除 `data/trips/` 相關路徑描述，新增 `data/trips-md/` 和 `data/dist/trips.json` 說明
- [x] 8.2 更新 memory `MEMORY.md`：更新專案架構和 skill 對照表
- [x] 8.3 更新 `openspec/config.yaml`：如有 `data/trips/` 路徑參照則修正
