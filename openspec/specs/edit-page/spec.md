# Spec: edit-page

AI 修改行程頁面，Claude 聊天介面風格。

## 頁面結構

- **URL**: `edit.html`（接受 `?trip=<slug>` 參數）
- **載入**: `shared.css` + `menu.css` + `edit.css` + `shared.js` + `menu.js` + `icons.js` + `edit.js`
- **CSP**: `connect-src 'self' https://api.github.com`

## 問候語區

- Spark icon（SVG 星形）+ 時段問候語 + owner 名稱
- 時段規則：06:00-11:59 早安 / 12:00-17:59 午安 / 18:00-05:59 晚安
- 副標：「有什麼行程修改需求？」

## Issue 歷史紀錄

- 透過 GitHub API 拉取 `--label trip-edit --state all --per_page 20` 的 Issues
- 顯示 issue 標題（可點擊跳轉 GitHub）、編號、建立時間
- 每筆前方顯示狀態圓點：open（綠色）/ closed（紫色）
- 區域獨立 `overflow-y: auto` 捲動
- 載入中顯示「載入中…」，失敗顯示「無法載入紀錄」

## 底部輸入區

- 固定在頁面底部的卡片式佈局
- **textarea**: 多行輸入，placeholder 含範例修改指令
- **工具列**:
  - 左：[+] 按鈕（佈局預留，disabled）
  - 中：行程名稱下拉選單（`<select>`），切換行程直接跳轉
  - 右：送出按鈕
- **送出按鈕狀態**: textarea 空 → `disabled` 暗色；有文字 → `#C4704F` 可按

## 送出流程

- POST GitHub Issue，title: `[trip-edit] {owner}: {text前50字}`
- body: JSON 含 owner / tripSlug / text / timestamp
- labels: `['trip-edit']`
- 成功後清空 textarea、重新載入 issue 列表
- 錯誤處理：401 Token 過期 / 403 權限不足 / 410 Issues 未啟用

## 行程決定邏輯

優先順序：`?trip=` URL 參數 → `localStorage trip-pref` → trips.json 第一筆
