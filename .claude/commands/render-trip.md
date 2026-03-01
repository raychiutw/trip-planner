處理旅伴送出的行程修改請求，自動套用到行程 JSON 並部署。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

步驟：
1. git pull origin master
2. gh issue list --label trip-edit --state open --json number,title,body
3. 無 open Issue → 回報「沒有待處理的請求」並結束
4. 依序處理每個 Issue：
   a. 解析 Issue body JSON → 取得 owner, tripSlug, text
   b. 驗證 owner 歸屬：
      → 讀取 data/trips.json，找到 tripSlug 對應的項目
      → 確認該項目的 owner 欄位 === Issue 中的 owner
      → 不符 → gh issue comment "❌ 權限錯誤：{owner} 無權修改此行程" + gh issue close → 跳過
   c. 讀取 data/trips/{tripSlug}.json
   d. 依自然語言 text 修改行程 JSON（遵循 CLAUDE.md 規範）
   e. 同步更新 checklist、backup、suggestions
   f. 確認 transit 分鐘數
   g. 執行 git diff --name-only：
      → 只有 data/trips/{tripSlug}.json → OK
      → 有其他檔案被改 → git checkout 還原非白名單檔案
   h. npm test
   i. 通過 → commit push + gh issue comment "✅ 已處理：{摘要}" + gh issue close
   j. 失敗 → git checkout . + gh issue comment "❌ 處理失敗：{錯誤}" + gh issue close

✅ 允許修改的檔案（正面表列，僅此一項）：
   data/trips/{tripSlug}.json — 且 tripSlug 必須與 owner 在 data/trips.json 中的歸屬一致

🚫 其他所有檔案一律不得修改，包括但不限於：
   js/*, css/*, index.html, edit.html, data/trips.json, tests/*, CLAUDE.md
