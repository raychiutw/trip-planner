## 1. 建立新 skill 檔案

- [x] 1.1 建立 `.claude/commands/tp-rebuild.md` — 單一行程全面重整 skill，包含完整 R1-R10 品質規則、輸入方式（tripSlug 或互動選擇）、白名單限制、R7 加入 shopping category 7 類標準分類定義
- [x] 1.2 建立 `.claude/commands/tp-rebuild-all.md` — 批次重建所有行程 skill，讀取 trips.json、逐一執行 rebuild 邏輯、顯示進度、最終 npm test
- [x] 1.3 建立 `.claude/commands/tp-issue.md` — GitHub Issue 處理 skill（原 render-trip 的 Issue 流程：git pull → gh issue list → 解析 → 修改 → commit push → close）

## 2. 移除舊 skill

- [x] 2.1 移除 `.claude/commands/render-trip.md`

## 3. 文件同步

- [x] 3.1 `CLAUDE.md` — 更新 skill 參照（render-trip → tp-rebuild / tp-rebuild-all / tp-issue）
- [x] 3.2 `memory/rules-architecture.md`、`memory/rules-content.md` — 更新 skill 名稱參照

（rules-json-schema.md、template.json、render-trip.md R7 已由 `docs-format-sync` change 處理）

## 4. 驗證

- [x] 4.1 確認三個新 skill 檔案存在且內容完整
- [x] 4.2 確認 render-trip.md 已移除
- [x] 4.3 npm test 全部通過（393 tests passed）
