# Design: pages-and-menu

## 架構決策

### 頁面結構：三頁式 → 維持三頁但替換 switch

- 維持 index / edit / setting 三頁架構
- setting.html 取代 switch.html，承接行程切換 + 新增色彩模式
- 每頁皆載入 shared.css + menu.css + 對應頁面 css/js

### 選單統一

- 全頁面共用兩種選單：sidebar（桌機）+ drawer（手機）
- 區段一（三頁通用）：行程頁 / 編輯頁 / 設定頁
- 區段二（僅 index）：功能跳轉項目 + 列印模式
- 深色模式按鈕從選單移除，改由 setting 頁統一管理
- 當前頁面項目加 `.menu-item-current` 樣式

### edit.html — Claude 聊天風格

- 頂部：spark icon + 時段問候語（06-12 早安 / 12-18 午安 / 18-06 晚安）+ owner 名稱
- 中間：GitHub API issue 列表（`--label trip-edit --state all`），獨立 `overflow-y: auto` 捲動
- 底部：固定輸入卡片 — [+] 預留 / 行程下拉 / 送出按鈕
- 送出按鈕狀態：textarea 空 → disabled 暗色；有文字 → `#C4704F` 可按
- 移除 localStorage history，改用 GitHub API 即時資料

### setting.html — 設定頁

- 區段一：行程切換（讀取 `data/trips.json`，選中項目存 `localStorage trip-pref`）
- 區段二：色彩模式（Light / Auto / Dark）三選一卡片
- Auto 模式使用 `prefers-color-scheme` media query
- 儲存至 `localStorage color-mode`，`shared.js` 初始化時讀取

## 色彩模式資料流

```
setting.js → lsSet('color-mode', 'light'|'auto'|'dark')
  ↓
shared.js IIFE（頁面載入時）→ lsGet('color-mode')
  ├─ 'dark'  → body.classList.add('dark')
  ├─ 'light' → 不加 dark
  ├─ 'auto'  → matchMedia('prefers-color-scheme: dark')
  └─ 未設定  → 舊版相容 lsGet('dark')
```

## 檔案影響

| 操作 | 檔案 |
|------|------|
| 新增 | `setting.html`, `css/setting.css`, `js/setting.js` |
| 重寫 | `edit.html`, `css/edit.css`, `js/edit.js` |
| 修改 | `js/app.js`（buildMenu）, `js/shared.js`（color-mode）, `css/menu.css`（menu-item-current） |
| 刪除 | `switch.html`, `css/switch.css`, `js/switch.js` |
