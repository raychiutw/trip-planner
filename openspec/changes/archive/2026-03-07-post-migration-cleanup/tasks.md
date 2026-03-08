## 1. 刪除過時腳本與殘留

- [x] 1.1 刪除 `scripts/fix-date-format.js`
- [x] 1.2 刪除 `scripts/normalize-trip-data.js`
- [x] 1.3 刪除空的 `data/trips/` 目錄

## 2. 修正 ps1 hard-coded 路徑

- [x] 2.1 `scripts/register-scheduler.ps1`：hard-coded 路徑改為 `$PSScriptRoot` + `Split-Path`
- [x] 2.2 `scripts/tp-issue-scheduler.ps1`：hard-coded 路徑改為 `$PSScriptRoot` + `Split-Path`

## 3. 移除 `/render-trip` 失效參照

- [x] 3.1 `openspec/config.yaml`：移除 `/render-trip` 那行
- [x] 3.2 `openspec/specs/trip-enrich-rules/spec.md`：所有 `/render-trip` 改為 `/tp-rebuild`
- [x] 3.3 `openspec/specs/food-preferences-field/spec.md`：overview 的 `/render-trip` 改為 `/tp-create` 和 `/tp-rebuild`
- [x] 3.4 `MEMORY.md`：移除 `/render-trip` 相關偏好描述

## 4. MD 範例檔取代 template.json

- [x] 4.1 建立 `data/examples/meta.md`：從現有行程萃取最小範例（含 name/owner/foodPreferences/selfDrive/countries/autoScrollDates + Footer）
- [x] 4.2 建立 `data/examples/flights.md`：航班表格範例
- [x] 4.3 建立 `data/examples/day-1.md`：到達日範例（Hotel + shopping + parking + 午餐 restaurants + 晚餐 restaurants + travel + blogUrl + rating + mapcode）
- [x] 4.4 建立 `data/examples/day-2.md`：中間日範例（景點 + gasStation + shopping + 全 infoBox 類型）
- [x] 4.5 建立 `data/examples/day-3.md`：出發日範例（退房 + 午餐 + 機場）
- [x] 4.6 建立 `data/examples/checklist.md`：出發前確認事項範例
- [x] 4.7 建立 `data/examples/backup.md`：雨天備案範例
- [x] 4.8 建立 `data/examples/suggestions.md`：AI 建議範例（high/medium/low）
- [x] 4.9 建立 `data/examples/emergency.md`：緊急聯絡資訊範例
- [x] 4.10 刪除 `data/examples/template.json`
- [x] 4.11 更新 `tp-create.md`：步驟 3 改為讀取 `data/examples/` MD 範例檔

## 5. 統一 skill 白名單為正面表列

- [x] 5.1 `tp-create.md`：白名單改為正面表列格式（僅允許編輯 `data/trips-md/`，`data/dist/` 為 build 產物嚴禁手動編輯）
- [x] 5.2 `tp-edit.md`：同上
- [x] 5.3 `tp-rebuild.md`：同上
- [x] 5.4 `tp-rebuild-all.md`：同上
- [x] 5.5 `tp-issue.md`：同上
- [x] 5.6 `tp-patch.md`：同上
- [x] 5.7 `CLAUDE.md`：更新 skill 白名單描述為正面表列；「異動行程結構時須同步更新 `data/examples/template.json`」改為「異動行程 MD 格式時須同步更新 `data/examples/*.md`」
- [x] 5.8 `MEMORY.md`：template 同步規則從 `template.json` 改為 `data/examples/*.md`

## 6. 驗證

- [x] 6.1 執行 `npm run build` 確認 build 正常
- [x] 6.2 執行全部測試確認無破損
