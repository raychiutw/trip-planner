## Why

quickpanel-ui-v2 上線後實機測試發現 7 個視覺問題：X 按鈕重疊、外觀主題 InfoSheet 版型壞掉、今日路線名稱截斷等。

## What Changes

### 截圖 1（QuickPanel）
- 下半部（列印/PDF/MD/JSON/CSV）改為 **5×1 單行**，`grid-template-columns: repeat(5, 1fr)` 動態平均分配
- 上下區域用**不同背景色**區隔：上半部卡牌 `--color-background`、下半部卡牌用較深一階（如 `--color-tertiary`）
- X 關閉按鈕位置修正，不與 grid 第三欄重疊
- 分隔線加粗或改用 spacing 間距區隔

### 截圖 2（外觀與主題 InfoSheet）
- 套用設定頁（SettingPage）的完整版型：色彩圓點 + 中文 label（移除英文副標）
- 減少 85% 高度的留白（內容居上或降低高度）

### 截圖 3（今日路線 InfoSheet）
- 景點名稱欄位不截斷或給足夠寬度，Map 連結改為下一行或縮寫

## Capabilities

### Modified Capabilities
- `quick-panel`: 下半部 5×1 + 色碼分區 + X 按鈕位置

## Impact
- css/style.css — QuickPanel grid + 色碼
- src/components/trip/QuickPanel.tsx — X 按鈕位置
- src/pages/TripPage.tsx — appearance sheet 版型
- src/components/trip/TodayRouteSheet.tsx — 路線名稱排版
