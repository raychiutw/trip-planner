## Context

現有 `/render-trip` skill（`.claude/commands/render-trip.md`）同時負責 GitHub Issue 讀取和行程 JSON 重整。無法單獨觸發「依最新規則全面重整行程」，也無法一次重建全部行程。品質規則 R1-R10 已寫在 render-trip.md 內。

## Goals / Non-Goals

**Goals:**
- 將 `/render-trip` 拆為三個獨立 skill：`/tp-rebuild`、`/tp-rebuild-all`、`/tp-issue`
- `/tp-rebuild` 可獨立觸發單一行程全面重整（不需 GitHub Issue）
- `/tp-rebuild-all` 可批次重建所有行程
- `/tp-issue` 保留原有的 GitHub Issue 處理流程
- R7 新增 shopping category 標準分類定義
- 文件同步（rules-json-schema.md、template.json）

**Non-Goals:**
- 不改 JS/CSS/HTML
- 不改行程 JSON 結構（結構由 `hotel-render-data-consistency` change 處理）
- 不改測試檔案

## Decisions

### D1：三個 skill 的職責邊界

| skill | 輸入 | 職責 | 輸出 |
|-------|------|------|------|
| `/tp-rebuild` | tripSlug（或互動選擇） | 讀取行程 JSON → 依 R1-R10 全面重整 → npm test | 修改後的行程 JSON |
| `/tp-rebuild-all` | 無（自動讀 trips.json） | 逐一對每個行程執行 rebuild 邏輯 → npm test | 所有行程 JSON |
| `/tp-issue` | 無（自動讀 GitHub Issues） | gh issue list → 解析 → 依 Issue text 局部修改（不全面重跑） → commit push → close | 行程 JSON + git commit |

**替代方案**：只拆兩個（rebuild + issue） → 缺少批次功能，規則更新後要手動跑四次。

### D2：R1-R10 品質規則放在哪

品質規則 R1-R10 目前寫在 `render-trip.md` 內。拆分後：
- 規則文字搬到 `/tp-rebuild.md`（核心 skill）
- `/tp-rebuild-all.md` 和 `/tp-issue.md` 引用 `/tp-rebuild` 的規則（不重複）

**替代方案**：獨立規則檔 → 增加維護點，三個 skill 不常同時修改，直接放 rebuild 裡最簡單。

### D3：`/tp-rebuild` 的「全面重整」範圍

全面重整 = 讀取現有行程 JSON，逐項檢查 R1-R10 並修正：
- R1：確認 foodPreferences 存在
- R2：檢查每日午晚餐完整性（含航程感知）
- R3：餐廳補到 3 家、必填欄位、blogUrl
- R4：景點 titleUrl/blogUrl/營業時間
- R5：飯店 blogUrl
- R6：搜尋 blogUrl
- R7：購物 infoBox 結構化（7 類 category）、subs 格式統一
- R8：breakfast/checkout 欄位
- R9：highlights summary 精簡
- R10：還車加油站

不重新產生行程內容（不改 timeline 順序、不加減景點），只確保現有內容符合規則。

### D4：shopping category 標準分類

定義 7 類，timeline 景點購物與飯店購物共用：

1. 超市 — AEON、UNION、MaxValu 等
2. 超商 — Lawson、FamilyMart、7-11 等
3. 唐吉軻德 — ドン・キホーテ 系列
4. 藥妝 — 松本清、ウエルシア 等
5. 伴手禮 — 御菓子御殿、鹽屋 等
6. 購物中心 — PARCO CITY、來客夢 等大型商場
7. Outlet — ASHIBINAA 等 Outlet 品牌店

### D5：`/tp-issue` 與 `/tp-rebuild` 的關係

`/tp-issue` 處理的是自然語言修改請求（如「Day 3 午餐換成拉麵」），不是全面重整。它解析 Issue 後直接修改 JSON，修改範圍由 Issue text 決定。修改完後走 commit/push/close 流程。

`/tp-issue` 不呼叫 `/tp-rebuild`。兩者獨立。

### D6：文件同步項目

| 文件 | 變更 |
|------|------|
| `rules-json-schema.md` | HotelSub 移除舊格式（格式一 label/text），只保留新格式（type/title/price/note/location） |
| `template.json` | 移除 `meta.name`/`meta.themeColor`、hotel.subs 改新格式、加 `meta.tripType` |
| `CLAUDE.md` | 更新 skill 參照（render-trip → tp-rebuild / tp-rebuild-all / tp-issue） |

## Risks / Trade-offs

- **規則分散在 skill 檔案中** → 目前規則量不大（R1-R10 約 60 行），放在 rebuild skill 內可接受。如果規則繼續增長，未來可抽出獨立規則檔。
- **`/tp-rebuild-all` 執行時間長** → 四個行程逐一重整可能需要較長時間（搜尋 blogUrl 等）。可接受，因為不是頻繁操作。
- **移除 render-trip 後舊文件引用失效** → 需同步更新 CLAUDE.md 和 memory 中的參照。
