## Context

現有 skill 體系（`.claude/commands/`）包含 `/deploy`、`/tp-rebuild`、`/tp-rebuild-all`、`/tp-issue`、`/add-spot`。品質檢查邏輯內嵌在 `/tp-rebuild` 中，無法單獨驗證；行程修改散落多處且無備份機制；命名前綴不統一；GitHub Issue 處理需手動觸發。

本次重構目標是建立統一的 `tp-*` skill 體系，抽出品質驗證為獨立層，加入備份與自動化。此外，網站目前完全沒有 favicon（三頁 HTML 皆無 `<link rel="icon">`），瀏覽器 tab 顯示空白預設圖。

## Goals / Non-Goals

**Goals:**
- 抽出 `/tp-check` 作為獨立品質驗證 skill，輸出紅綠燈 report
- 建立 `/tp-edit` 統一自然語言編輯入口
- 所有修改行程的 skill 在修改前自動備份 JSON
- `/tp-deploy` 統一命名，純部署
- Windows Task Scheduler 自動化 `/tp-issue`
- 建立網站 favicon（地圖 Pin + TP 文字）

**Non-Goals:**
- 不新增品質規則（R1-R12 維持不變，只是改由 tp-check 輸出）
- 不修改 js/css/tests（HTML 僅加 favicon link 標籤）
- 不實作 tp-check 為程式碼模組（維持 skill 內 inline 邏輯）
- 不建置 CI/CD pipeline（排程跑在本機 Windows）

## Decisions

### D1: tp-check report 格式

report 使用紅綠燈三級狀態：

| 狀態 | 符號 | 意義 |
|------|------|------|
| passed | 🟢 | 完全符合規則 |
| warning | 🟡 | 有瑕疵但不阻擋（warn 級規則或部分缺失） |
| failed | 🔴 | 不符合規則 |

**完整模式**（standalone、before-fix）：
```
══════════════════════════════════════════════
  tp-check Report: {tripSlug}
  {timestamp}
══════════════════════════════════════════════

  Summary:  🟢 N passed  🟡 N warnings  🔴 N failed

──────────────────────────────────────────────
  Rule          Status   Detail
──────────────────────────────────────────────
  R1  偏好       🟢
  R2  餐次       🟢
  ...
──────────────────────────────────────────────

  🟡 Warnings (N):
  ├── RX: {detail}
  └── RY: {detail}

  🔴 Failures (N):
  └── RZ: {detail}

══════════════════════════════════════════════
```

**精簡模式**（after-edit）：
```
tp-check: 🟢 10  🟡 2  🔴 0
```

### D2: tp-check 嵌入策略

| Skill | 嵌入方式 | 模式 |
|-------|----------|------|
| `/tp-check slug` | 獨立執行 | 完整 report |
| `/tp-rebuild slug` | before-fix + after-fix | 完整 report x2 |
| `/tp-edit slug` | after-edit | 精簡 summary |
| `/tp-issue` | after-edit（每個 Issue） | 精簡 summary |
| `/tp-deploy` | 不嵌入 | — |
| `/tp-rebuild-all` | 每趟 after-fix | 完整 report x N |

**為何 tp-deploy 不嵌入**：deploy 是純部署動作，品質在修改階段已把關完畢。加入 check 會拖慢部署且職責不清。

### D3: tp-edit 與 tp-issue 的關係

```
                    ┌───────────────────┐
  GitHub Issue ────▶│  /tp-issue        │
                    │  解析 Issue body  │
                    │  呼叫 tp-edit 邏輯│
                    └────────┬──────────┘
                             │
  CLI 輸入 ────────▶┌────────▼──────────┐
                    │  /tp-edit         │
                    │  1. 備份          │
                    │  2. 局部修改      │
                    │  3. tp-check 精簡 │
                    └───────────────────┘
```

`/tp-issue` 是 `/tp-edit` 的 GitHub Issue 包裝：解析 Issue → 提取 tripSlug + text → 執行 tp-edit 邏輯 → commit + push + close Issue。

`/tp-edit` 本身是底層 skill：接受 tripSlug + 自然語言描述 → 備份 → 局部修改 → tp-check。

### D4: 備份機制

```
data/backup/
├── okinawa-trip-2026-Ray_2026-03-05T143022.json
├── okinawa-trip-2026-Ray_2026-03-05T160511.json
└── ...
```

- 路徑：`data/backup/{tripSlug}_{YYYY-MM-DDTHHMMSS}.json`
- 時間戳不含 `:`（Windows 檔名限制）
- 每個 tripSlug 最多保留 10 份，超過刪除最舊
- 備份檔案簽入版控（隨 commit 一起進 git）
- 觸發時機：修改行程 JSON **前**（tp-rebuild、tp-edit、tp-issue）

**替代方案**：在 tp-deploy 時備份。不選此方案因為備份目的是「回到修改前狀態」，應在修改前拍快照。

### D5: Windows Task Scheduler 架構

```
scripts/
├── tp-issue-scheduler.ps1      每次執行的腳本
├── register-scheduler.ps1      一次性：註冊排程
├── unregister-scheduler.ps1    一次性：移除排程
└── tp-issue.log                執行記錄（gitignore）
```

- 使用 `claude --dangerously-skip-permissions -p "/tp-issue"` 執行（無人值守模式）
- 排程名稱：`TripPlanner-AutoIssue`
- 間隔：每 15 分鐘
- 設定：電池模式仍執行、多重實例忽略新的
- log 追加模式，記錄每次執行的時間戳

**前提條件**：Git credentials、GitHub CLI（gh）、Node.js、Claude CLI 皆在 PATH 中。

### D6: /add-spot 棄用

`/add-spot` 的功能（新增景點到指定日）完全涵蓋在 `/tp-edit` 的自然語言編輯範圍內。直接刪除 `.claude/commands/add-spot.md`。

### D7: Favicon 設計（方案 B：地圖 Pin + TP）

**造型**：地圖 Pin（水滴倒置形狀），Pin 頭內嵌 **TP** 粗體白色文字。

**配色**：
- 背景填色：`#C4704F`（--accent 陶土色，與 theme-color 一致）
- 文字：`#FFFFFF` 白色
- 暗色模式不需另外出圖（favicon 不隨頁面主題變化）

**格式與尺寸**：

```
images/
├── favicon.svg            主要 favicon（SVG，向量無限縮放）
├── favicon-32x32.png      傳統 favicon
├── favicon-16x16.png      小尺寸 favicon
├── apple-touch-icon.png   iOS 主畫面 180×180
├── icon-192.png           PWA / Android 192×192
└── icon-512.png           PWA splash 512×512
```

**SVG 實作方式**：手寫 SVG，使用 `<path>` 畫 Pin 輪廓 + `<text>` 渲染 TP 文字。不依賴外部字型（使用 SVG 內嵌 font-family: Arial, sans-serif）。

**PNG 產生**：從 SVG 用工具轉換各尺寸 PNG（或直接以程式碼產生固定尺寸的 PNG data URI）。由於專案無 build 工具，採用手動一次性轉換。

**HTML 整合**：三頁（index.html、edit.html、setting.html）的 `<head>` 加入：
```html
<link rel="icon" href="images/favicon.svg" type="image/svg+xml">
<link rel="icon" href="images/favicon-32x32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="images/apple-touch-icon.png">
```

**替代方案**：
- 方案 A（純 TP 文字）：辨識度不足，缺乏旅遊語義
- 方案 C（飛機）：16px 下細節太多看不清
- 方案 D（行李箱）：太通用，無品牌辨識度

## Risks / Trade-offs

**[tp-check 是 skill 內 inline 邏輯，非程式模組]** → 各 skill 描述 tp-check 的行為而非 import 共用程式碼。若規則變更需同步更新多個 skill 檔案。可接受：skill 檔案是 prompt，不是程式碼，Claude 每次讀取最新版本。

**[Windows 排程依賴本機環境]** → 需要 Claude CLI、gh、Node.js 都在 PATH。首次設定門檻較高，但 register-scheduler.ps1 一鍵完成。

**[--dangerously-skip-permissions 安全風險]** → tp-issue skill 內建安全機制：只改 data/trips/*.json、失敗自動 git checkout 還原、npm test 通過才 commit。風險可控。

**[備份進 git 會增加 repo 大小]** → 每個行程 JSON 約 100-200KB，10 份上限 = 每個行程最多 2MB 備份。可接受，且提供遠端備份保障。
