# Spec: unified-menu

三頁統一選單結構。

## 選單類型

全頁面共用兩種選單元件（由 `menu.js` 管理）：

1. **Sidebar**（桌機 ≥768px）：左側固定，可收合
2. **Drawer**（手機 <768px）：從左側滑入，backdrop 遮罩

## 選單區段

### 區段一（三頁通用）

頁面導航連結，當前頁面加 `.menu-item-current` 樣式：

| 項目 | Icon | 連結 |
|------|------|------|
| 行程頁 | `plane` | `index.html` |
| 編輯頁 | `pencil` | `edit.html?trip={slug}` |
| 設定頁 | `gear` | `setting.html` |

### 區段二（僅 index.html）

功能跳轉項目 + 列印模式：

- 航班資訊、交通統計、出發前確認、行程建議、颱風備案、緊急聯絡
- 列印模式（`data-action="toggle-print"`）

### 已移除

- 深色模式 toggle 按鈕（改在 setting 頁管理）
- switch.html 相關連結

## 實作函式

| 頁面 | 函式 | 位置 |
|------|------|------|
| index | `buildMenu()` | `js/app.js` |
| edit | `buildEditMenu(slug)` | `js/edit.js` |
| setting | `buildSettingMenu()` | `js/setting.js` |

每個函式同時渲染 `#menuGrid`（drawer）和 `#sidebarNav`（sidebar）。
