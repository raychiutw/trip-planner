# 內容規則

- 繁體中文台灣用語，日文店名保留原文
- `days[].label` 行程名稱不超過 8 個字
- 用餐時段 1.5 小時，每餐三選一，標註營業時間，可預約者附連結
- `travel` 必須含交通類型（`car`/`train`/`walking`/`bus`/`flight`）+ 描述（含分鐘數如「約40分鐘」）

## MD 連動

- `days` 變動 → 同步重建 `checklist.md`、`backup.md`、`suggestions.md`
- 確認 travel 描述含分鐘數（供 `calcDrivingStats()` 計算）
- 確保無已刪除景點殘留、無遺漏新增景點提醒

## Skill 清單

- `/tp-create`：從零產生完整行程 MD 檔案群
- `/tp-edit`：自然語言描改指定行程 MD
- `/tp-request`：處理旅伴 GitHub Issue 修改請求
- `/tp-rebuild`：全面重整單一行程 MD
- `/tp-rebuild-all`：批次重建所有行程
- `/tp-check`：唯讀品質規則驗證
- `/tp-patch`：跨行程局部欄位批次更新
- `/tp-deploy`：commit + push + 開啟 Cloudflare Pages
- `/tp-run`、`/tp-shutdown`：本機開發伺服器
