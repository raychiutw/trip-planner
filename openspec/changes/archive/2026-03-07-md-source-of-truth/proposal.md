## Why

目前行程資料有三份：完整 JSON（`data/trips/*.json`）、MD 中間格式（`data/trips-md/`）、dist 分檔 JSON（`data/dist/`）。前端已改為讀取 dist，但 skills 仍操作完整 JSON 再 split → build，造成三份資料同步維護的負擔。需要確立 MD 為唯一 source of truth，移除完整 JSON 與相關冗餘程式碼。

## What Changes

- **BREAKING** 移除 `data/trips/*.json`（7 個完整行程 JSON）
- **BREAKING** 移除 `data/trips.json`（手動維護的行程 registry）
- 移除 `data/backup/`（完整 JSON 備份目錄）
- 移除 `scripts/trip-split.js`（JSON → MD，不再需要）
- 移除 `scripts/diff-roundtrip.js`（round-trip 比對）
- 移除 `tests/unit/trip-roundtrip.test.js`
- 移除 `poc.html`
- `scripts/build-all.js` 改名為 `scripts/build.js`，拿掉 split 步驟，新增掃描 `dist/*/meta.json` 自動產生 `data/dist/trips.json`
- `data/trips-md/*/meta.md` frontmatter 新增 `name` 和 `owner` 欄位
- `scripts/trip-build.js` 支援 `name`/`owner` 欄位輸出到 `meta.json`
- `js/setting.js` 改為 `fetch('data/dist/trips.json')`
- `js/edit.js` 改為 `fetch('data/dist/trips.json')`
- `js/app.js` 移除 `TRIP_FILE` 變數，簡化 `fileToSlug`
- 全部 8 個 tp-* skills 路徑從 `data/trips/*.json` 改為 `data/trips-md/{slug}/`
- `package.json` 的 `build` 指令改為 `node scripts/build.js`
- 更新相關測試（schema、registry、routing）

## Capabilities

### New Capabilities
- `md-trip-source`: MD 檔案群作為行程 source of truth，定義 skills 讀寫 MD 的規範與 build 流程
- `auto-trip-registry`: build 時自動從 meta.json 產生 `dist/trips.json`，取代手動維護的 registry

### Modified Capabilities
- `trip-json-validation`: 驗證對象從完整 JSON 改為 dist JSON 或 MD frontmatter
- `tp-create-skill`: 產出格式從完整 JSON 改為 MD 檔案群
- `tp-edit-skill`: 操作對象從完整 JSON 改為 MD 檔案
- `trip-json-backup`: 備份機制從完整 JSON 備份改為 git 追蹤 MD（移除 data/backup/）

## Impact

- **檔案範圍**：js/app.js、js/setting.js、js/edit.js、scripts/*、tests/*、.claude/commands/tp-*.md、data/
- **Build 流程**：`npm run build` 不再執行 split，只跑 build + registry 產生
- **Cloudflare Pages**：build command 不變（`npm run build`），但內部邏輯簡化
- **Skills**：所有 tp-* skills 需全面改寫路徑與操作方式
- **資料遷移**：需先在 meta.md 補上 `name`/`owner`，完成後才能刪除完整 JSON 與 trips.json
