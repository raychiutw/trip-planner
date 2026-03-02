# pages-and-menu

新增 setting 頁、重設計 edit 頁、移除 switch 頁、統一選單。

## 範圍（全裝置）

### setting.html（新頁面）
- 區段一：切換行程檔（列出 trips.json 所有行程，選中項目標示）
- 區段二：外觀 — 色彩模式三選一（Light / Auto / Dark），Auto 跟隨系統 prefers-color-scheme
- 新增 `js/setting.js` + `css/setting.css`

### edit.html（重新設計）
- Claude 聊天介面風格：spark icon + 時段問候語（早安/午安/晚安）+ owner 名稱
- Issue 歷史紀錄：透過 GitHub API 拉 `--label trip-edit` 的 Issues 顯示在輸入框上方，顯示 issue 狀態（open/closed），獨立上下捲動
- 輸入區：底部卡片式，左側 [+] 不實作（僅佈局預留），中間行程名下拉可切換行程，右側送出按鈕
- 送出按鈕：textarea 空 → 暗色 disabled；有字 → Claude 橘可按
- 移除 localStorage history，改用 GitHub API 即時資料

### switch.html（移除）
- 刪除 switch.html、js/switch.js、css/switch.css
- 功能已併入 setting.html

### 統一選單結構
- 三頁選單樣式一致
- 區段一（全部頁面）：行程頁 / 編輯頁 / 設定頁
- 區段二（僅 index）：功能跳轉（航班、交通統計、出發前確認、行程建議、颱風備案、緊急聯絡、列印模式）
- 深色模式從選單移除（改在 setting 頁設定）
