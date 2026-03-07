## Context

md-source-of-truth 遷移後，`data/trips/` 和 `data/trips.json` 已刪除，資料流改為 `data/trips-md/ → npm run build → data/dist/`。但部分腳本、文件、skill 白名單仍殘留舊架構參照。

## Goals / Non-Goals

**Goals:**
- 刪除所有已失效的腳本和參照
- ps1 腳本可在任意使用者目錄運行
- skill 白名單採正面表列，語意清晰
- tp-create 參考 MD 範例而非 JSON 範本

**Non-Goals:**
- 不改動 js/css/html 前端程式碼
- 不調整 build pipeline 邏輯
- 不修改 archive 中的歷史文件

## Decisions

### D1: ps1 使用 `$PSScriptRoot` 取代 hard-coded 路徑

PowerShell 內建 `$PSScriptRoot` 自動解析為腳本所在目錄。`Split-Path $PSScriptRoot` 取得專案根目錄。無需傳入參數，零設定即可運行。

### D2: skill 白名單正面表列格式

現行格式（負面表列）：
```
禁止修改 js/css/html
```

新格式（正面表列）：
```
僅允許編輯：
  data/trips-md/{slug}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**
```

git diff 驗證邏輯：diff 中只能出現 `data/trips-md/` 和 `data/dist/`，但後者必須由 build 產生而非手動編輯。

### D3: `/render-trip` 參照更新策略

- `openspec/config.yaml`：移除該行（render-trip 已不存在）
- `openspec/specs/trip-enrich-rules/spec.md`：`/render-trip` → `/tp-rebuild`（因為 trip-enrich-rules 描述的是重建行程時的餐廳推薦行為）
- `openspec/specs/food-preferences-field/spec.md`：`/render-trip` → `/tp-create` 和 `/tp-rebuild`
- `MEMORY.md`：移除 `/render-trip` 相關偏好描述

### D4: MD 範例檔取代 template.json

現在 tp-create 讀 `data/examples/template.json`（JSON 格式），但實際產出是 MD 檔案群。造成格式斷層。

改為 `data/examples/` 下放一套最小完整的 MD 範例（3 天行程），涵蓋所有 pattern：

```
data/examples/
├── meta.md          ← frontmatter + Footer（自駕/非自駕皆示範）
├── flights.md       ← 航班表格
├── day-1.md         ← 到達日：Hotel + shopping + parking + 午餐 + 晚餐 + travel
├── day-2.md         ← 中間日：景點 + gasStation + 一日遊團 + 全 infoBox 類型
├── day-3.md         ← 出發日：退房 + 午餐 + 機場
├── checklist.md     ← 出發前確認事項
├── backup.md        ← 雨天備案
├── suggestions.md   ← AI 建議（high/medium/low）
└── emergency.md     ← 緊急聯絡資訊
```

從現有 7 行程萃取最小範例，每個欄位都有值但只保留 1-2 個代表性 entry。包含 comments 標註哪些是條件性欄位（如 naver 僅韓國、mapcode 僅沖繩、parking 僅自駕）。

tp-create.md 步驟 3 改為：「讀取 `data/examples/` 下的 MD 範例檔作為格式參考」。

## Risks / Trade-offs

- **archive 中仍有 render-trip 參照** → 刻意不修改，archive 是歷史快照
- **ps1 改動後需重新註冊 Task Scheduler** → 使用者需執行 `unregister-scheduler.ps1` 再 `register-scheduler.ps1`
- **刪除 template.json 後 tp-create 行為改變** → MD 範例涵蓋所有 pattern，AI 參考 MD 比 JSON 更直覺
