## Why

網站加入主畫面後仍在 Safari 中開啟（有 URL bar），status bar 顏色固定不隨主題/dark mode 變化，與原生 App 體驗有明顯差距。PWA Manifest + Standalone 模式 + 動態 theme-color 是工作量最小但效果最大的改善。

## What Changes

- 新增 `manifest.json`（Web App Manifest），支援 Add to Home Screen 以 standalone 模式啟動
- 在 `index.html`（及其他 HTML 入口）加入 `<link rel="manifest">` + Apple PWA meta tags
- 動態更新 `<meta name="theme-color">` 隨主題色和 dark mode 變化，讓 Safari toolbar / status bar 與頁面融合
- 製作 PWA icon（192x192 + 512x512）

## Capabilities

### New Capabilities
- `pwa-experience`: PWA Manifest + Standalone 模式 + 動態 theme-color

### Modified Capabilities
（無）

## Impact

- **新增檔案**：`manifest.json`、PWA icon 圖片
- **HTML**：`index.html`、`setting.html`、`manage/index.html`、`admin/index.html` 加入 meta tags
- **JS**：`src/hooks/useDarkMode.ts` 或 `src/entries/main.tsx` 加入 theme-color 動態更新
- **建置**：`vite.config.ts` 可能需要 copy manifest 到 dist
