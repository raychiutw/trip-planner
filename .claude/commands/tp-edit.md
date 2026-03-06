接受自然語言描述，局部修改指定行程 JSON。修改前自動備份，修改後自動執行 tp-check 精簡 report。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 輸入方式

- 指定 tripSlug + 描述：`/tp-edit okinawa-trip-2026-Ray Day 3 午餐換成拉麵`
- 未指定 tripSlug：讀取 `data/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips/{tripSlug}.json`
2. **備份**：複製到 `data/backup/{tripSlug}_{YYYY-MM-DDTHHMMSS}.json`
   - 建立 `data/backup/` 目錄（若不存在）
   - 同一 tripSlug 超過 10 個備份時，刪除最舊的
3. 依自然語言描述**局部修改**行程 JSON（只改描述涉及的部分）
4. 新增或替換的 POI 須標記 `source` 欄位：
   - 使用者明確指定名稱（如「換成一蘭拉麵」）→ `"source": "user"`
   - 使用者僅給模糊描述（如「換成拉麵店」）→ `"source": "ai"`
5. 修改的部分須符合 R1-R13 品質規則
6. 若影響到 checklist、backup、suggestions，同步更新
7. 確認 transit 分鐘數
8. 執行 `git diff --name-only`：
   → 只有 `data/trips/{tripSlug}.json` → OK
   → 有其他檔案被改 → `git checkout` 還原非白名單檔案
9. `npm test`
10. 執行 tp-check 精簡模式，輸出：`tp-check: 🟢 N  🟡 N  🔴 N`
11. 不自動 commit（由使用者決定）

## 局部修改 vs 全面重整

本 skill 只處理描述涉及的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 Day 3 午餐 entry
- 「加一個景點到 Day 2」→ 只在 Day 2 timeline 插入
- 「刪除 Day 4 的購物行程」→ 只移除該 entry

**不全面重跑 R1-R12**。如需全面重整，使用 `/tp-rebuild`。

✅ 允許修改的檔案（正面表列，僅此一項）：
   data/trips/{tripSlug}.json

🚫 其他所有檔案一律不得修改，包括但不限於：
   js/*, css/*, index.html, edit.html, data/trips.json, tests/*, CLAUDE.md

## 品質規則參照

完整品質規則定義在 `trip-quality-rules.md`。本 skill 修改的部分須符合相關規則。
