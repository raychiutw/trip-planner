## Why

md-source-of-truth 遷移完成後，專案中殘留了過時的腳本、失效的 skill 參照、hard-coded 路徑，以及 skill 白名單語意不清（負面表列 vs 正面表列）的問題。需要一次性清理，確保程式碼庫與文件一致。

## What Changes

- **刪除過時腳本**：`scripts/fix-date-format.js`、`scripts/normalize-trip-data.js`（操作已刪除的 `data/trips/*.json`）
- **修正 ps1 hard-coded 路徑**：`register-scheduler.ps1` 和 `tp-issue-scheduler.ps1` 改用 `$PSScriptRoot` 動態取得專案根目錄
- **移除 `/render-trip` 參照**：config.yaml、MEMORY.md、活躍 specs 中的失效 skill 名稱更新為 `/tp-rebuild` 或 `/tp-create`
- **統一 skill 白名單為正面表列**：所有 tp-* skills 改為「只能編輯 `data/trips-md/`，其餘一律禁止」，`data/dist/` 標示為 build 產物（僅 `npm run build` 可產生，不可手動編輯）
- **MD 範例取代 JSON 範本**：建立 `data/examples/` MD 範例檔群（從現有 7 行程萃取最小範例），取代 `data/examples/template.json`；tp-create 改參考 MD 範例
- **刪除殘留空目錄與檔案**：刪除空的 `data/trips/` 目錄、`data/examples/template.json`

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `trip-enrich-rules`: `/render-trip` 參照改為 `/tp-rebuild`
- `tp-edit-skill`: 白名單語意從負面表列改為正面表列，明確禁止手動編輯 `data/dist/`
- `tp-create-skill`: 範本從 `template.json` 改為 `data/examples/` MD 範例檔

## Impact

- **腳本**：刪除 `scripts/fix-date-format.js`、`scripts/normalize-trip-data.js`
- **PowerShell**：`scripts/register-scheduler.ps1`、`scripts/tp-issue-scheduler.ps1`
- **OpenSpec config**：`openspec/config.yaml`
- **OpenSpec specs**：`openspec/specs/trip-enrich-rules/spec.md`、`openspec/specs/food-preferences-field/spec.md`
- **Skills**：`.claude/commands/tp-create.md`、`tp-edit.md`、`tp-rebuild.md`、`tp-rebuild-all.md`、`tp-issue.md`、`tp-patch.md`
- **Memory**：`MEMORY.md`
- **範例檔**：新增 `data/examples/*.md`，刪除 `data/examples/template.json`
- **殘留目錄**：刪除空的 `data/trips/`
- 不涉及 JSON 結構變更，不影響 js/css/html
