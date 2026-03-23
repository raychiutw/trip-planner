## 1. QuickPanel 佈局修正

- [x] 1.1 下半部 grid 改為 `repeat(5, 1fr)` 單行 5 欄
- [x] 1.2 雙色分區：上半部卡牌 `--color-background`，下半部卡牌 `--color-tertiary`（較深），icon/label 用 `--color-muted`
- [x] 1.3 分隔用 spacing 間距區隔（不用 border line）
- [x] 1.4 X 關閉按鈕位置修正，不與 grid 第三欄重疊
- [x] 1.5 X 按鈕開啟時不顯示 focus ring（:focus:not(:focus-visible) 確認生效）
- [x] 1.6 手機版/桌機版高度都要 85%

## 2. 外觀主題 InfoSheet 版型

- [x] 2.1 色彩模式按鈕完全套用 SettingPage 的 .color-mode-card 樣式（移除英文副標）
- [x] 2.2 色彩主題按鈕完全套用 SettingPage 的 .color-theme-card 樣式（色彩圓點 + 中文 label）
- [x] 2.3 高度維持 85%，內容居上
- [x] 2.4 讀取 SettingPage + setting.css 確認版型完全一致

## 3. 今日路線 InfoSheet 版面重排

- [x] 3.1 改為雙行佈局：第一行 時間+完整名稱，第二行 Map 連結+Mapcode
- [x] 3.2 名稱不截斷，給足夠寬度

## 4. 驗證

- [x] 4.1 npx tsc --noEmit 全過
- [x] 4.2 npm test 全過
