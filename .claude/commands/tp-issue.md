處理旅伴送出的行程修改請求（GitHub Issue），以 tp-edit 邏輯局部修改行程 JSON 並部署。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 步驟

1. `git pull origin master`
2. `gh issue list --label trip-edit --state open --json number,title,body`
3. 無 open Issue → 回報「沒有待處理的請求」並結束
4. 依序處理每個 Issue：
   a. 解析 Issue body JSON → 取得 owner, tripSlug, text
   b. 讀取 `data/trips/{tripSlug}.json`
   c. **備份**：複製到 `data/backup/{tripSlug}_{YYYY-MM-DDTHHMMSS}.json`
      - 建立 `data/backup/` 目錄（若不存在）
      - 同一 tripSlug 超過 10 個備份時，刪除最舊的
   d. 依 Issue text 內容**局部修改**行程 JSON（只改 text 描述的部分，不全面重跑 R1-R12）
   e. 修改的部分須符合 R1-R12 品質規則
   f. 若影響到 checklist、backup、suggestions，同步更新
   g. 確認 transit 分鐘數
   h. 執行 `git diff --name-only`：
      → 只有 `data/trips/{tripSlug}.json` → OK
      → 有其他檔案被改 → `git checkout` 還原非白名單檔案
   i. `npm test`
   j. **tp-check 精簡 report**：輸出 `tp-check: 🟢 N  🟡 N  🔴 N`
   k. 通過 → commit push + `gh issue comment "✅ 已處理：{摘要}"` + `gh issue close`
   l. 失敗 → `git checkout .` + `gh issue comment "❌ 處理失敗：{錯誤}"` + `gh issue close`

## 局部修改 vs 全面重整

本 skill 只處理 Issue text 描述的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 Day 3 午餐 entry
- 「加一個景點到 Day 2」→ 只在 Day 2 timeline 插入

**不全面重跑 R1-R12**。如需全面重整，使用 `/tp-rebuild`。

✅ 允許修改的檔案（正面表列，僅此一項）：
   data/trips/{tripSlug}.json

🚫 其他所有檔案一律不得修改，包括但不限於：
   js/*, css/*, index.html, edit.html, data/trips.json, tests/*, CLAUDE.md

## 品質規則參照

完整 R1-R12 品質規則定義在 `/tp-rebuild` skill 中。本 skill 修改的部分須符合相關規則。
