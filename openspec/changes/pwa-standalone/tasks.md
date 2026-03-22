## 1. PWA Manifest

- [x] 1.1 新增 `public/manifest.json`：name, short_name, start_url, display: standalone, background_color, theme_color, icons
- [x] 1.2 產生 PWA icon：`public/icons/icon-192.png` + `public/icons/icon-512.png`（使用現有 favicon 為基底）

## 2. HTML Meta Tags

- [x] 2.1 在 `index.html` 加入 `<link rel="manifest">` + Apple PWA meta tags
- [x] 2.2 在 `setting.html`、`manage/index.html`、`admin/index.html` 加入相同的 meta tags

## 3. 動態 Theme-Color

- [x] 3.1 在 `src/hooks/useDarkMode.ts` 加入 theme-color 動態更新邏輯：theme/dark mode 變化時更新 `<meta name="theme-color">` 為 `--color-background` 值

## 4. 測試

- [x] 4.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
