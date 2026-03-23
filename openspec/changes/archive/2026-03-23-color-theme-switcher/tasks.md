## 1. CSS 變數重構

- [x] 1.1 將 `:root` 中的色彩變數抽離，`:root` 僅保留非色彩 token（spacing、radius、font-size、duration、font-family）
- [x] 1.2 建立 `body.theme-sun` 淺色配色（珊瑚橘 accent、暖沙奶白背景、海藍輔助）
- [x] 1.3 建立 `body.theme-sun.dark` 深色配色
- [x] 1.4 建立 `body.theme-sky` 淺色配色（天空藍 accent、冰藍暖白背景、薄荷綠輔助）
- [x] 1.5 建立 `body.theme-sky.dark` 深色配色
- [x] 1.6 建立 `body.theme-zen` 淺色配色（赤茶 accent、和紙色背景、抹茶藍鼠輔助）
- [x] 1.7 建立 `body.theme-zen.dark` 深色配色
- [x] 1.8 確認現有 `body.dark` 選擇器遷移至主題化結構，移除舊的單一 dark 覆寫

## 2. Hook 擴展

- [x] 2.1 擴展 `useDarkMode.ts`：新增 `colorTheme` 狀態讀取（localStorage `colorTheme` key，預設 `sun`）
- [x] 2.2 初始化時套用 `theme-*` class 到 body，確保與 `dark` class 正交運作
- [x] 2.3 匯出 `setTheme(theme)` 函式，切換時更新 body class + localStorage
- [x] 2.4 切換主題或模式時同步更新 `<meta name="theme-color">`
- [x] 2.5 為 hook 新增 unit test（主題切換、localStorage 持久化、預設值 fallback）

## 3. 設定頁 UI

- [x] 3.1 在 `SettingPage.tsx`「外觀」區段下方新增「色彩主題」小節標題
- [x] 3.2 新增三張主題卡片（陽光/晴空/和風），用各主題 accent 色呈現
- [x] 3.3 點選卡片即時切換主題，選中卡片顯示 accent border
- [x] 3.4 主題卡片適配深色模式顯示

## 4. HTML 與 Build

- [x] 4.1 各頁 HTML（index、setting、manage、admin）的 `<meta name="theme-color">` 設為陽光預設值
- [x] 4.2 執行 `npm run build` 更新 dist 產物
- [x] 4.3 確認 css-hig.test.js 通過

## 5. 測試

- [x] 5.1 E2E 測試：設定頁主題卡片可見、點選切換生效
- [x] 5.2 E2E 測試：主題切換後 reload 保持
- [x] 5.3 E2E 測試：主題與深淺模式獨立運作
