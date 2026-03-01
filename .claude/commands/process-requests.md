檢查 GitHub Issues 中的待處理行程修改請求。

步驟：
1. git pull origin master
2. gh issue list --label trip-edit --state open --json number,title,body
3. 無 open Issue → 回報「沒有待處理的請求」並結束
4. 依序處理每個 Issue：
   a. 解析 Issue body JSON → 取得 owner, tripSlug, text
   b. 讀取 data/trips/{tripSlug}.json
   c. 依自然語言 text 修改行程 JSON（遵循 CLAUDE.md 規範）
   d. 同步更新 checklist、backup、suggestions
   e. 確認 transit 分鐘數
   f. 執行 git diff --name-only：
      → 只有 data/trips/{tripSlug}.json → OK
      → 有其他檔案被改 → git checkout 還原非白名單檔案
   g. npm test
   h. 通過 → commit push + gh issue comment "✅ 已處理：{摘要}" + gh issue close
   i. 失敗 → git checkout . + gh issue comment "❌ 處理失敗：{錯誤}" + gh issue close

⚠️ 禁止修改以下檔案：js/app.js, js/shared.js, js/edit.js, css/style.css,
   css/shared.css, css/edit.css, index.html, edit.html, 及 data/trips.json。
   只能修改 data/trips/{tripSlug}.json。
