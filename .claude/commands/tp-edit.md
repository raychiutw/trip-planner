接受自然語言描述，局部修改指定行程 MD 檔案。修改後執行 build + tp-check 精簡 report。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 輸入方式

- 指定 tripId + 描述：`/tp-edit okinawa-trip-2026-Ray Day 3 午餐換成拉麵`
- 未指定 tripId：讀取 `data/dist/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips-md/{tripId}/` 下的 MD 檔案（meta.md + 相關 day-N.md）
2. 依自然語言描述**局部修改**對應的 MD 檔案（只改描述涉及的部分）
3. 新增或替換的 POI 須標記 `source` 欄位：
   - 使用者明確指定名稱（如「換成一蘭拉麵」）→ `"source": "user"`
   - 使用者僅給模糊描述（如「換成拉麵店」）→ `"source": "ai"`
4. 修改的部分須符合 R1-R14 品質規則
4b. 韓國行程（`meta.countries` 含 `"KR"`）新增或修改 POI 時，須為 location 新增 `naverQuery`（Naver Maps URL，優先精確 place URL，查不到時用搜尋式 URL `https://map.naver.com/v5/search/{韓文關鍵字}`）
5. 若影響到 checklist、backup、suggestions，同步更新對應 MD 檔案
6. 確認 travel 分鐘數
7. 執行 `npm run build` 更新 dist
8. 執行 `git diff --name-only`：
   → 只有 `data/trips-md/{tripId}/**` + `data/dist/**` → OK
   → 有其他檔案被改 → `git checkout` 還原非白名單檔案
9. `npm test`
10. 執行 tp-check 精簡模式，輸出：`tp-check: 🟢 N  🟡 N  🔴 N`
11. 不自動 commit（由使用者決定）

## 局部修改 vs 全面重整

本 skill 只處理描述涉及的修改範圍，例如：
- 「Day 3 午餐換成拉麵」→ 只改 day-3.md 午餐 entry
- 「加一個景點到 Day 2」→ 只在 day-2.md timeline 插入
- 「刪除 Day 4 的購物行程」→ 只移除該 entry

**不全面重跑 R1-R12**。如需全面重整，使用 `/tp-rebuild`。

僅允許編輯：
  data/trips-md/{tripId}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

## 品質規則參照

完整品質規則定義在 `trip-quality-rules.md`。本 skill 修改的部分須符合相關規則。
