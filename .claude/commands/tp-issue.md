處理旅伴送出的行程修改請求（GitHub Issue），以 tp-edit 邏輯局部修改行程 MD 並部署。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 步驟

1. `git pull origin master`
2. `gh issue list --label trip-edit --state open --json number,title,body`
3. 無 open Issue → 回報「沒有待處理的請求」並結束
4. 依序處理每個 Issue：
   a. 解析 Issue body JSON → 取得 owner, tripSlug, text
   b. 讀取 `data/trips-md/{tripSlug}/` 下的 MD 檔案
   c. 依 Issue text 內容**局部修改**對應的 MD 檔案（只改 text 描述的部分，不全面重跑 R1-R13）
   d. 新增或替換的 POI 須標記 `source` 欄位：
      - 使用者明確指定名稱（如「換成一蘭拉麵」）→ `"source": "user"`
      - 使用者僅給模糊描述（如「換成拉麵店」）→ `"source": "ai"`
   e. 修改的部分須符合 R1-R13 品質規則
   f. 若影響到 checklist、backup、suggestions，同步更新對應 MD 檔案
   g. 確認 transit 分鐘數
   h. 執行 `npm run build` 更新 dist
   i. 執行 `git diff --name-only`：
      → 只有 `data/trips-md/{tripSlug}/**` + `data/dist/**` → OK
      → 有其他檔案被改 → `git checkout` 還原非白名單檔案
   j. `npm test`
   k. **tp-check 精簡 report**：輸出 `tp-check: 🟢 N  🟡 N  🔴 N`
   l. 通過 → commit push + `gh issue comment "✅ 已處理：{摘要}"` + `gh issue close`
   m. 失敗 → `git checkout .` + `gh issue comment "❌ 處理失敗：{錯誤}"` + `gh issue close`

## 局部修改 vs 全面重整

本 skill 只處理 Issue text 描述的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 day-3.md 午餐 entry
- 「加一個景點到 Day 2」→ 只在 day-2.md timeline 插入

**不全面重跑 R1-R13**。如需全面重整，使用 `/tp-rebuild`。

僅允許編輯：
  data/trips-md/{tripSlug}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

## 品質規則參照

完整品質規則定義在 `trip-quality-rules.md`。本 skill 修改的部分須符合相關規則。
