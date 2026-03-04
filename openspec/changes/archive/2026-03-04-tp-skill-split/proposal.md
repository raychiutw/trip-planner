## Why

現有 `/render-trip` skill 將「從 GitHub Issue 讀取修改請求」和「依 R1-R10 規則重整行程 JSON」兩個職責綁在一起，無法單獨觸發行程重整（例如規則更新後想重跑全部行程），也無法一次批次重建所有行程。需要拆分為三個獨立 skill 以提升彈性。

## What Changes

1. **新增 `/tp-rebuild`** — 全面重整單一行程 JSON，依 R1-R10 品質規則重新檢查並修正所有欄位（blogUrl、餐廳推薦、購物 infoBox、早餐、退房等），輸入為 tripSlug 或互動選擇
2. **新增 `/tp-rebuild-all`** — 讀取 `trips.json` 逐一對每個行程執行 `/tp-rebuild` 邏輯，最後 `npm test` 驗證
3. **新增 `/tp-issue`** — 原 `/render-trip` 的 GitHub Issue 處理流程（`gh issue list` → 解析 → 套用修改 → commit push → close Issue）
4. **移除 `/render-trip`** — 由以上三個 skill 取代

## Capabilities

### New Capabilities
- `tp-rebuild-skill`: `/tp-rebuild` skill 定義 — 單一行程全面重整的步驟、輸入方式、品質規則引用
- `tp-rebuild-all-skill`: `/tp-rebuild-all` skill 定義 — 批次重建所有行程的步驟、trips.json 讀取、逐一呼叫 rebuild 邏輯
- `tp-issue-skill`: `/tp-issue` skill 定義 — GitHub Issue 處理流程（原 render-trip 的 Issue 讀取 + 修改 + commit + close）

### Modified Capabilities
- `trip-enrich-rules`: R7 新增 shopping category 標準分類定義（7 類），供 `/tp-rebuild` 重整時參照

## Impact

- **Skill 檔案**：新增 `.claude/commands/tp-rebuild.md`、`.claude/commands/tp-rebuild-all.md`、`.claude/commands/tp-issue.md`；移除 `.claude/commands/render-trip.md`
- **JSON 資料**：`/tp-rebuild-all` 執行後會修改 `data/trips/*.json`（依 R1-R10 重整）
- **CLAUDE.md**：更新 skill 參照（render-trip → tp-rebuild / tp-rebuild-all / tp-issue）
- **rules-json-schema.md**：HotelSub 移除舊格式（格式一），只保留新格式
- **template.json**：移除 `meta.name`/`meta.themeColor`、subs 改新格式、加 `meta.tripType`
- **HTML/CSS/JS**：無變更
- **checklist/backup/suggestions**：無連動影響
