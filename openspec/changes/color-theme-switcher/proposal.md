## Why

目前網站只有單一配色方案（森林綠），整體氛圍偏專業嚴肅，缺乏旅遊休閒感。使用者希望能在多種風格間切換，讓不同類型的行程（海島、都市、文化）都有更貼合的視覺體驗。

## What Changes

- 新增三套色彩主題：**陽光**（海灘風珊瑚橘）、**晴空**（清新天空藍）、**和風**（日式文青赤茶）
- 每套主題各有淺色 + 深色版本，共 6 組 CSS 變數配置
- 設定頁「外觀」區段下方新增「色彩主題」選擇列（三張主題卡片）
- `localStorage` 新增 `colorTheme` 鍵（`sun` / `sky` / `zen`），與現有 `colorMode` 獨立運作
- `useDarkMode` hook 擴展為同時管理 theme class（`theme-sun` / `theme-sky` / `theme-zen`）
- 各頁 `<meta name="theme-color">` 改為由 JS 動態設定，配合主題切換
- 現有 `:root` 和 `body.dark` 的固定配色改為 `theme-sun` 預設值

## Capabilities

### New Capabilities
- `color-theme-system`: 三套色彩主題的 CSS 變數定義、class 切換邏輯、localStorage 持久化
- `theme-picker-ui`: 設定頁的色彩主題選擇器 UI 元件

### Modified Capabilities
- `setting-page`: 新增色彩主題選擇區段
- `design-tokens`: CSS 變數從單一組擴展為主題化結構

## Impact

- `css/shared.css` — 重構變數結構，新增 6 組主題配色
- `src/hooks/useDarkMode.ts` — 擴展為管理 theme + mode 雙軸
- `src/pages/SettingPage.tsx` — 新增主題選擇 UI
- `index.html`、`setting.html`、`manage/index.html`、`admin/index.html` — meta theme-color 動態化
- `dist/` — 需 rebuild
- 測試：需新增主題切換的 unit test 和 e2e test
